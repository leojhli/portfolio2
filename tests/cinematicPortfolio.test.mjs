import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import { createServer } from "vite"
import { JSDOM } from "jsdom"
import React, { act } from "react"
import { createRoot } from "react-dom/client"

let server, App, scene
const virtualScene = "\0test:cloister-scene"

before(async () => {
  server = await createServer({
    server: { middlewareMode: true },
    logLevel: "silent",
    plugins: [
      {
        name: "controlled-cloister-for-ui-tests",
        enforce: "pre",
        resolveId(id) {
          if (id.endsWith("/CloisterView")) return virtualScene
        },
        load(id) {
          if (id !== virtualScene) return
          return `import React, { useEffect } from 'react';
          let props, mounts = 0, unmounts = 0;
          export const state = () => ({props, mounts, unmounts});
          export default function TestScene(next) {
            props = next;
            useEffect(() => {mounts++; return () => {unmounts++;}}, []);
            return React.createElement('div', {'data-controlled-scene': true});
          }`
        },
      },
    ],
  })
  scene = await server.ssrLoadModule(virtualScene)
  App = (await server.ssrLoadModule("/src/App.tsx")).default
})
after(async () => server?.close())

// The scene is controlled explicitly: these tests cover DOM navigation and media,

// not WebGL appearance, choreography or frame rate.
async function mount({ hash = "", reduced = false } = {}) {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', {
    url: `http://localhost/${hash}`,
    pretendToBeVisual: true,
  })
  const w = dom.window
  for (const name of [
    "window",
    "document",
    "HTMLElement",
    "Element",
    "Node",
    "Image",
    "Event",
    "MouseEvent",
    "KeyboardEvent",
    "localStorage",
    "history",
    "location",
  ])
    globalThis[name] = name === "window" ? w : w[name]
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  globalThis.getComputedStyle = w.getComputedStyle.bind(w)
  globalThis.addEventListener = w.addEventListener.bind(w)
  globalThis.removeEventListener = w.removeEventListener.bind(w)
  const motionPreference = new w.EventTarget()
  motionPreference.matches = reduced
  w.matchMedia = () => motionPreference
  w.scrollTo = () => {}
  w.scrollBy = () => {}
  w.HTMLElement.prototype.scrollTo = function ({ top = 0 }) {
    this.scrollTop = top
  }
  w.HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "")
  }
  w.HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open")
    this.dispatchEvent(new w.Event("close"))
  }
  const audios = []
  globalThis.Audio = class extends w.EventTarget {
    paused = true
    currentTime = 0
    duration = 200
    src = ""
    volume = 0.8
    constructor() {
      super()
      audios.push(this)
    }
    async play() {
      this.paused = false
      this.dispatchEvent(new w.Event("playing"))
    }
    pause() {
      this.paused = true
      this.dispatchEvent(new w.Event("pause"))
    }
  }
  const root = createRoot(w.document.getElementById("root"))
  await act(async () => {
    root.render(React.createElement(App))
  })
  const click = async (selector) => {
    const node =
      typeof selector === "string"
        ? w.document.querySelector(selector)
        : selector
    assert.ok(node, `Expected control: ${selector}`)
    await act(async () =>
      node.dispatchEvent(
        new w.MouseEvent("click", { bubbles: true, cancelable: true }),
      ),
    )
  }
  return {
    w,
    click,
    audios,
    async changeReducedMotion(enabled) {
      motionPreference.matches = enabled
      await act(async () =>
        motionPreference.dispatchEvent(new w.Event("change")),
      )
    },
    props: () => scene.state().props,
    phase: () => w.document.querySelector(".cine-portfolio").dataset.phase,
    async cleanup() {
      await act(async () => root.unmount())
      dom.window.close()
    },
  }
}

test("late scene readiness preserves direct chapter navigation and keeps portfolio text usable", async () => {
  const f = await mount()
  try {
    assert.equal(f.phase(), "loading")
    assert.ok(f.w.document.querySelector(".cine-loading-runner"))
    assert.equal(f.audios.length, 0, "arriving creates no audio instance")
    await f.click('.cine-chapters a[href="#projects"]')
    assert.equal(f.phase(), "reading")
    assert.equal(f.props().segment, 1)
    assert.equal(f.w.location.hash, "#projects")
    assert.equal(f.w.document.activeElement.id, "cine-projects-heading")
    assert.match(
      f.w.document.getElementById("projects").textContent,
      /The cloister portfolio/,
    )
    assert.equal(
      f.w.document.querySelector("#projects .cine-project-links a").href,
      "https://github.com/leojhli/portfolio2",
    )
    assert.doesNotMatch(
      f.w.document.getElementById("projects").textContent,
      /\[Project title\]/,
    )
    await act(async () => f.props().onReady())
    assert.equal(
      f.phase(),
      "reading",
      "loading cannot restart a visitor who chose a chapter",
    )
    assert.equal(f.props().segment, 1)
    await f.click("#projects .cine-continue")
    assert.equal(f.phase(), "playing")
    assert.equal(f.props().segment, 2)
    assert.equal(f.w.document.activeElement.textContent, "Pause")
    await act(async () => f.props().onComplete(1))
    assert.equal(
      f.phase(),
      "playing",
      "late completion from another shot is ignored",
    )
    await act(async () => f.props().onComplete(2))
    assert.equal(f.phase(), "reading")
    assert.equal(f.w.document.activeElement.id, "cine-about-heading")
  } finally {
    await f.cleanup()
  }
})

test("pause, replay and aerial controls preserve one scene and reject stale completions", async () => {
  const f = await mount()
  try {
    await act(async () => f.props().onReady())
    assert.equal(f.phase(), "playing")
    const start = f.props()
    const sceneElement = f.w.document.querySelector("[data-controlled-scene]")
    const mounts = scene.state().mounts
    await f.click('.cine-film-controls button[aria-controls="cine-credits"]')
    assert.match(
      f.w.document.activeElement.getAttribute("aria-label"),
      /Close credits/,
    )
    await act(async () =>
      f.w.dispatchEvent(new f.w.KeyboardEvent("keydown", { key: "Escape" })),
    )
    assert.equal(f.w.document.getElementById("cine-credits"), null)
    assert.equal(
      f.w.document.activeElement.getAttribute("aria-controls"),
      "cine-credits",
    )
    assert.equal(f.props().onReady, start.onReady)
    assert.equal(f.props().onComplete, start.onComplete)
    assert.equal(f.props().revision, start.revision)
    assert.equal(scene.state().mounts, mounts)
    assert.equal(
      f.w.document.querySelector("[data-controlled-scene]"),
      sceneElement,
    )
    await f.click(
      [...f.w.document.querySelectorAll(".cine-film-controls button")].find(
        (b) => b.textContent === "Pause",
      ),
    )
    assert.equal(f.phase(), "paused")
    await act(async () => f.props().onComplete(0))
    assert.equal(
      f.phase(),
      "paused",
      "a completion cannot dismiss an explicit pause",
    )
    await f.click(
      [...f.w.document.querySelectorAll(".cine-film-controls button")].find(
        (b) => b.textContent === "Resume",
      ),
    )
    await act(async () => f.props().onComplete(0))
    assert.equal(f.phase(), "reading")
    await f.click(
      [...f.w.document.querySelectorAll(".cine-film-controls button")].find(
        (b) => b.textContent.includes("Replay film"),
      ),
    )
    assert.equal(f.phase(), "playing")
    assert.ok(f.props().revision > start.revision)
    await act(async () => start.onComplete(0))
    assert.equal(
      f.phase(),
      "playing",
      "a previous run cannot complete a replay",
    )
    await f.click('.cine-chapters a[href="#contact"]')
    await f.click("#contact .cine-continue")
    assert.equal(f.props().segment, 4)
    await f.click(
      [...f.w.document.querySelectorAll(".cine-film-controls button")].find(
        (b) => b.textContent.includes("Skip scene"),
      ),
    )
    assert.equal(
      f.phase(),
      "aerial",
      "skipping the pullback still reaches the aerial view",
    )
    const revision = f.props().revision
    await f.click(".cine-aerial-caption button")
    assert.equal(f.props().revision, revision + 1)
    assert.equal(f.phase(), "aerial")
    assert.equal(scene.state().mounts, mounts)
  } finally {
    await f.cleanup()
  }
})

test("About retains media and expansion state across chapters, and failed graphics keep all content navigable", async () => {
  const f = await mount({ hash: "#about" })
  try {
    assert.equal(f.phase(), "reading")
    assert.equal(f.props().segment, 2)
    assert.equal(f.audios.length, 0)
    const about = f.w.document.getElementById("about")
    const folds = [...about.querySelectorAll("details")]
    assert.equal(folds.length, 5)
    assert.equal(about.querySelectorAll(".photo img").length, 4)
    assert.match(about.textContent, /Swimming & coaching/)
    const music = folds.find(
      (fold) => fold.querySelector("summary").textContent === "Music",
    )
    music.open = true
    await f.click(music.querySelector('button[aria-label="Play"]'))
    assert.equal(f.audios.length, 1)
    const audio = f.audios[0]
    audio.currentTime = 47
    await act(async () => audio.dispatchEvent(new f.w.Event("timeupdate")))
    assert.equal(audio.paused, false)
    await f.click('.cine-chapters a[href="#experience"]')
    await f.click('.cine-chapters a[href="#about"]')
    assert.equal(f.w.document.getElementById("about"), about)
    assert.equal(music.open, true)
    assert.equal(audio.currentTime, 47)
    assert.equal(audio.paused, false)
    await act(async () => f.props().onFailure("asset unavailable"))
    assert.equal(f.phase(), "fallback")
    assert.equal(
      f.w.document.querySelector("[data-controlled-scene]"),
      null,
      "a failed renderer is released",
    )
    assert.match(f.w.document.querySelector(".cine-still").alt, /cloister/)
    await f.click('.cine-chapters a[href="#contact"]')
    assert.equal(f.phase(), "fallback")
    assert.deepEqual(
      [...f.w.document.querySelectorAll(".cine-contact-list a")].map(
        (a) => a.href,
      ),
      ["https://github.com/leojhli"],
      "only verified destinations are shown",
    )
    await f.click("#contact .cine-continue")
    assert.equal(f.w.document.activeElement.id, "cine-experience-heading")
    assert.equal(f.phase(), "fallback")
    assert.equal(f.audios.length, 1)
  } finally {
    await f.cleanup()
  }
})

test("arrival autoplays the hero; later preference changes still skip motion", async () => {
  const f = await mount({ reduced: true })
  try {
    assert.equal(f.phase(), "loading")
    assert.match(f.w.document.querySelector(".cine-introduction h1").textContent, /Leo Li/)
    await act(async () => f.props().onReady())
    assert.equal(f.phase(), "playing", "no logo click is needed")
    await f.changeReducedMotion(false)
    await f.changeReducedMotion(true)
    assert.equal(f.phase(), "reading")
    assert.equal(f.props().segment, 0)
    assert.equal(f.w.document.activeElement.id, "cine-experience-heading")
    for (const [index, id] of [
      "experience",
      "projects",
      "about",
      "contact",
    ].entries()) {
      assert.equal(f.props().segment, index)
      assert.equal(f.phase(), "reading")
      await f.click(`#${id} .cine-continue`)
    }
    assert.equal(f.phase(), "aerial")
    assert.equal(f.props().segment, 4)
    await f.click(
      [...f.w.document.querySelectorAll(".cine-film-controls button")].find(
        (b) => b.textContent.includes("Replay film"),
      ),
    )
    assert.equal(f.phase(), "playing")
    await act(async () => f.props().onComplete(0))
    await f.click("#experience .cine-continue")
    assert.equal(
      f.phase(),
      "playing",
      "choosing the film also opts into later scenes",
    )
    assert.equal(f.props().segment, 1)
    await f.changeReducedMotion(false)
    await f.changeReducedMotion(true)
    assert.equal(
      f.phase(),
      "reading",
      "the current system choice overrides the earlier opt-in",
    )
    await f.click("#projects .cine-continue")
    assert.equal(f.phase(), "reading")
    assert.equal(f.props().segment, 2)
  } finally {
    await f.cleanup()
  }
})

test("logo replay before assets arrive still starts the introduction", async () => {
  const f = await mount({ reduced: true })
  try {
    await f.click(".cine-brand")
    assert.equal(f.phase(), "loading")
    await act(async () => f.props().onReady())
    assert.equal(f.phase(), "playing")
  } finally {
    await f.cleanup()
  }
})

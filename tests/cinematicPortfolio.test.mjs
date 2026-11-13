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
  // Each mode is code-split; wait for the chosen one to arrive.
  for (let i = 0; i < 200 && !w.document.querySelector(".cine-portfolio, .rs-page"); i++)
    await act(async () => new Promise((resolve) => setTimeout(resolve, 10)))
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
    const clip = f.w.document.querySelector("#projects video.cine-project-video")
    assert.equal(clip.getAttribute("src"), "/projects/betago.mp4")
    assert.ok(clip.muted && clip.loop)
    assert.ok(f.w.document.querySelector("#projects .cine-ascii canvas"))
    assert.match(
      f.w.document.getElementById("projects").textContent,
      /BetaGo[\s\S]*Video to ASCII[\s\S]*Did You Even Listen/,
    )
    assert.equal(
      f.w.document.querySelector("#projects .cine-project-links a").href,
      "https://github.com/leojhli/BetaGo",
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
    await f.click(".cine-continue")
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
    assert.equal(f.w.document.activeElement.id, "cine-contact-heading")
    assert.match(f.w.document.querySelector(".cine-continue").textContent, /to explore/)
    assert.doesNotMatch(f.w.document.querySelector(".cine-reading").textContent, /Swim/)
    await f.click("#cine-contact-heading")
    assert.equal(f.phase(), "reading", "clicking the text does not advance the film")
    await f.click("[data-controlled-scene]")
    assert.equal(f.phase(), "playing", "clicking the drawing continues the film")
    assert.equal(f.props().segment, 3)
  } finally {
    await f.cleanup()
  }
})

test("pause, replay and aerial controls preserve one scene and reject stale completions", async () => {
  const f = await mount()
  try {
    assert.equal(f.w.document.querySelector(".cine-enter"), null, "no entry before the scene loads")
    await act(async () => f.props().onProgress(0.4))
    assert.equal(f.w.document.querySelector(".cine-progress").getAttribute("aria-valuenow"), "40")
    await act(async () => f.props().onReady())
    assert.equal(f.phase(), "loading", "the film waits for the visitor")
    assert.equal(f.w.document.querySelector(".cine-gate").dataset.open, "false")
    await f.click(".cine-enter")
    assert.equal(f.phase(), "playing")
    assert.equal(f.w.document.querySelector(".cine-gate").dataset.open, "true")
    const soundSwitch = f.w.document.querySelector(".cine-sound")
    assert.equal(soundSwitch.getAttribute("aria-pressed"), "true")
    await f.click(soundSwitch)
    assert.equal(soundSwitch.getAttribute("aria-pressed"), "false")
    assert.equal(f.w.localStorage.getItem("pf.sound"), "off")
    await f.click(soundSwitch)
    assert.ok([...f.w.document.querySelectorAll(".cine-film-controls button")].some(b => b.textContent.includes("Replay film")))
    const start = f.props()
    const sceneElement = f.w.document.querySelector("[data-controlled-scene]")
    const mounts = scene.state().mounts
    await f.click('.cine-film-controls button[aria-controls="cine-credits"]')
    assert.match(f.w.document.getElementById("cine-credits").textContent, /Inspired by Assassin’s Creed/)
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
    await f.click(".cine-continue")
    assert.equal(f.props().segment, 3)
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

test("the removed About chapter is gone, and failed graphics keep all content navigable", async () => {
  const f = await mount({ hash: "#projects" })
  try {
    assert.equal(f.phase(), "reading")
    assert.equal(f.props().segment, 1)
    assert.equal(f.w.document.getElementById("about"), null)
    assert.deepEqual(
      [...f.w.document.querySelectorAll(".cine-chapters a")].map((a) => a.textContent),
      ["Experience", "Projects", "Contact"],
    )
    await f.click('.cine-chapters a[href="#experience"]')
    const experience = f.w.document.getElementById("experience").textContent
    assert.match(experience, /Undergraduate Researcher[\s\S]*UW Reality Labs/)
    assert.doesNotMatch(f.w.document.querySelector(".cine-reading").textContent, /\[[A-Z]/)
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
        (a) => a.getAttribute("href"),
      ),
      [
        "mailto:l734li@uwaterloo.ca",
        "/Leo_Li_Resume.pdf",
        "https://www.linkedin.com/in/leojhli/",
        "https://github.com/leojhli",
        "https://x.com/leojhli",
        "https://www.instagram.com/leojhli/",
      ],
    )
    await f.click(".cine-continue")
    assert.equal(f.w.document.activeElement.id, "cine-experience-heading")
    assert.equal(f.phase(), "fallback")
    assert.equal(f.audios.length, 0)
  } finally {
    await f.cleanup()
  }
})

test("entering from the loading screen plays the hero; later preference changes still skip motion", async () => {
  const f = await mount({ reduced: true })
  try {
    assert.equal(f.phase(), "loading")
    assert.match(f.w.document.querySelector(".cine-introduction h1").textContent, /Leo Li/)
    await act(async () => f.props().onReady())
    await f.click(".cine-enter")
    assert.equal(f.phase(), "playing", "one click on the loading screen starts the film")
    await f.changeReducedMotion(false)
    await f.changeReducedMotion(true)
    assert.equal(f.phase(), "reading")
    assert.equal(f.props().segment, 0)
    assert.equal(f.w.document.activeElement.id, "cine-experience-heading")
    for (const [index, id] of [
      "experience",
      "projects",
      "contact",
    ].entries()) {
      assert.equal(f.props().segment, index)
      assert.equal(f.phase(), "reading")
      await f.click(".cine-continue")
    }
    assert.equal(f.phase(), "aerial")
    assert.equal(f.props().segment, 3)
    await f.click(
      [...f.w.document.querySelectorAll(".cine-film-controls button")].find(
        (b) => b.textContent.includes("Replay film"),
      ),
    )
    assert.equal(f.phase(), "playing")
    await act(async () => f.props().onComplete(0))
    await f.click(".cine-continue")
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
    await f.click(".cine-continue")
    assert.equal(f.phase(), "reading")
    assert.equal(f.props().segment, 2)
    assert.equal(f.w.location.hash, "#contact")
  } finally {
    await f.cleanup()
  }
})

test("experience is one line per role with a logo, and Quickview lists everything without the film", async () => {
  const f = await mount({ hash: "#experience" })
  try {
    const roles = [...f.w.document.querySelectorAll("#experience .cine-roles > li")]
    assert.deepEqual(
      roles.map((li) => li.querySelector("h3").textContent.replace(/\s+/g, " ").trim()),
      [
        "Undergraduate Researcher @ University of Waterloo",
        "Software Engineer @ UW Reality Labs",
        "Software Engineer @ Waterloo Rocketry",
        "Creator @ Coding In Unity",
      ],
    )
    for (const li of roles) {
      assert.ok(li.querySelector("img.cine-role-logo").getAttribute("src").startsWith("/logos/"))
      assert.equal(li.querySelectorAll("p").length, 2, "dates and one summary line only")
    }
    const link = f.w.document.querySelector(".cine-mode-link")
    assert.equal(link.getAttribute("href"), "/quickview")
    assert.equal(link.textContent.trim(), "Quickview")
    // Switching modes covers the page with the curtain, then swaps in place.
    await f.click(link)
    assert.equal(f.w.document.querySelector(".mode-curtain").dataset.state, "in")
    assert.ok(f.w.document.querySelector(".cine-portfolio"), "the film stays until it is covered")
    for (let i = 0; i < 300 && f.w.document.querySelector(".mode-curtain").dataset.state !== "idle"; i++)
      await act(async () => new Promise((resolve) => setTimeout(resolve, 10)))
    assert.equal(f.w.location.pathname, "/quickview")
    assert.ok(f.w.document.querySelector(".rs-page"))
    assert.equal(f.w.document.querySelector(".cine-portfolio"), null)
    await f.click('.rs-top nav a[href="/"]')
    for (let i = 0; i < 300 && !f.w.document.querySelector(".cine-portfolio"); i++)
      await act(async () => new Promise((resolve) => setTimeout(resolve, 10)))
    assert.equal(f.w.location.pathname, "/")
    assert.ok(f.w.document.querySelector(".cine-portfolio"))
    for (let i = 0; i < 300 && f.w.document.querySelector(".mode-curtain").dataset.state !== "idle"; i++)
      await act(async () => new Promise((resolve) => setTimeout(resolve, 10)))
  } finally {
    await f.cleanup()
  }
  const r = await mount({ hash: "quickview" })
  try {
    const page = r.w.document.querySelector(".rs-page")
    assert.ok(page)
    assert.equal(r.w.document.querySelector(".cine-portfolio"), null)
    assert.equal(r.w.document.querySelector("[data-controlled-scene]"), null, "no 3D scene in Quickview")
    for (const text of [/Fast Multipole Attention/, /372 recordings/, /Waterloo Rocketry/, /Orion launch app/, /50 Unity tutorials/, /312 ms to 115 ms/, /Groq Whisper/, /Computer Engineering/, /PyTorch/])
      assert.match(page.textContent, text)
    assert.ok(page.querySelector('a[href="/Leo_Li_Resume.pdf"]'))
    assert.ok(page.querySelector('a[href="/"]'))
  } finally {
    await r.cleanup()
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

// Any [bracketed] value is unfilled and hidden by the site. Books and music live in ./library.
// Replace values here (or swap getContent() for a CMS/API adapter later).
import { books, tracks } from "./library"

export type ContactId = "linkedin" | "github" | "resume" | "email" | "x" | "instagram"
export type Contact = {
  id: ContactId
  label: string
  href?: string
}
/** What a link shows when the pointer rests on it in Quickview. */
export type Preview =
  | { kind: "image"; src: string; caption?: string }
  | { kind: "logo"; src: string; caption?: string }
  | { kind: "video"; src: string; poster?: string; caption?: string }
  | { kind: "ascii"; src: string; caption?: string }
export type Experience = {
  id: string
  role: string
  organization: string
  /** Square logo in public/, shown beside the organization. */
  logo?: string
  /** Accent colour for this entry in Quickview. */
  accent?: string
  preview?: Preview
  url?: string
  dates: string
  /** One line for the film's Experience chapter. */
  summary: string
  /** Full résumé bullets, listed in résumé mode. */
  points: string[]
}
/** 3D landmark that stands for a project on the Projects planet. */
export type Landmark = "lighthouse" | "observatory" | "rocket" | "windmill" | "antenna"
export type Project = {
  id: string
  landmark?: Landmark
  title: string
  summary: string
  technologies: string[]
  /** Full résumé bullets, listed in résumé mode. */
  points?: string[]
  /** Accent colour for this entry in Quickview. */
  accent?: string
  preview?: Preview
  image?: string
  /** A looping, silent clip shown with the project. */
  video?: string
  poster?: string
  /** "ascii" plays `video` behind a sweeping video-to-ASCII divider. */
  demo?: "ascii"
  mediaLabel?: string
  repoUrl?: string
  liveUrl?: string
}
export type Book = {
  id: string
  title: string
  author: string
  status: string
  year?: number
  pages?: number
  tags?: string[]
  synopsis?: string
  note?: string
  cover?: string
  tint: number
  height: number
}
export type Track = {
  id: string
  title: string
  artist: string
  src?: string
  artwork?: string
}
/**
 * `logo`: optional official logo file (e.g. '/logos/minecraft.svg' in public/).
 * `clip`: optional short gameplay loop (e.g. '/clips/minecraft.mp4', or an imported asset URL);
 * muted, looped, and previewed on hover. `poster`: still frame shown before playback.
 */
export type Game = {
  id: string
  name: string
  url?: string
  logo?: string
  clip?: string
  poster?: string
}

const content = {
  profile: {
    displayName: "Leo Li",
    chineseName: "李嘉和",
    intro:
      "I'm a first-year computer engineering student. I research efficient attention for Transformers and build software for UW Reality Labs and Waterloo Rocketry.",
    headline: "Computer Engineering @ University of Waterloo",
    portrait: undefined as string | undefined,
    // A music file in public/ (for example "/music/theme.mp3") replaces the
    // generated score. Only use a recording you have the rights to publish.
    music: "/music/theme.mp3" as string | undefined,
  },
  contacts: [
    { id: "email", label: "Email", href: "mailto:l734li@uwaterloo.ca" },
    { id: "resume", label: "Résumé", href: "/Leo_Li_Resume.pdf" },
    { id: "linkedin", label: "LinkedIn", href: "https://www.linkedin.com/in/leojhli/" },
    { id: "github", label: "GitHub", href: "https://github.com/leojhli" },
    { id: "x", label: "X", href: "https://x.com/leojhli" },
    { id: "instagram", label: "Instagram", href: "https://www.instagram.com/leojhli/" },
  ] as Contact[],
  experience: [
    {
      id: "fma-research",
      role: "Undergraduate Researcher",
      organization: "University of Waterloo",
      logo: "/logos/uwaterloo.webp",
      url: "https://uwaterloo.ca/",
      accent: "#d9a400",
      preview: { kind: "logo", src: "/logos/uwaterloo-lg.webp", caption: "University of Waterloo" },
      dates: "Nov 2026 – Present",
      summary:
        "Researching Fast Multipole Attention, a cheaper alternative to self-attention, with Prof. Giang Tran.",
      points: [
        "Investigating Fast Multipole Attention (FMA) under Professor Giang Tran, exploring efficient Transformer architectures that reduce the computational complexity of standard self-attention.",
        "Implementing FlashAttention using blockwise computation and online softmax, reducing GPU memory overhead by never materializing the full attention matrix.",
      ],
    },
    {
      id: "uw-reality-labs",
      role: "Software Engineer",
      organization: "UW Reality Labs",
      logo: "/logos/uw-reality-labs.webp",
      accent: "#7c5cff",
      url: "https://uwrealitylabs.com/",
      preview: { kind: "logo", src: "/logos/uw-reality-labs-lg.webp", caption: "uwrealitylabs.com" },
      dates: "Sep 2026 – Present",
      summary: "Adapting a SLAM system to run on the Qualcomm RB5 for headset head tracking.",
      points: [
        "Adapting a SLAM system to the Qualcomm RB5 so a standalone headset can track head pose from its cameras and IMU.",
        "Built a Python validation tool for gesture-recognition datasets, auditing 372 recordings across 22 JSON files and reporting data-quality issues with precise source locations.",
        "Implemented 5 dataset validation checks, covering missing sequence and confidence fields, empty recording lists, invalid record types, and empty recording objects.",
        "Implemented sliding-window segmentation, confidence filtering, and sequence padding to prepare gesture data for ML training.",
      ],
    },
    {
      id: "waterloo-rocketry",
      role: "Software Engineer",
      organization: "Waterloo Rocketry",
      logo: "/logos/waterloo-rocketry.webp",
      preview: { kind: "logo", src: "/logos/waterloo-rocketry-lg.webp", caption: "waterloorocketry.com" },
      accent: "#ff6a2b",
      url: "https://www.waterloorocketry.com/",
      dates: "2026 – Present",
      summary: "Building the Orion launch app for Waterloo's student rocketry team.",
      points: [],
    },
    {
      id: "coding-in-unity",
      role: "Creator",
      organization: "Coding In Unity",
      logo: "/logos/coding-in-unity.webp",
      preview: { kind: "image", src: "/previews/coding-in-unity.webp", caption: "youtube.com/@CodingInUnity" },
      accent: "#3d7bff",
      url: "https://www.youtube.com/@CodingInUnity",
      dates: "May 2020 – Present",
      summary: "Published 50 Unity tutorials, reaching 2k subscribers and 210k views.",
      points: [
        "Published 50 Unity tutorials on a game development YouTube channel, reaching 2k subscribers and 210k views.",
      ],
    },
  ] as Experience[],
  education: {
    school: "University of Waterloo",
    logo: "/logos/uwaterloo.webp",
    programUrl: "https://uwaterloo.ca/future-students/programs/computer-engineering",
    programPreview: {
      kind: "image",
      src: "/previews/uw-computer-engineering.webp",
      caption: "uwaterloo.ca · Computer Engineering",
    } as Preview,
    degree: "Bachelor of Applied Science in Computer Engineering",
    dates: "Sep 2026 – Apr 2031",
    coursework: ["Fundamentals of Programming (C++)", "Linear Algebra", "Calculus I"],
  },
  // Worlds 2026 Pick'ems, from the scored bracket: 10 / 20 / 80 points per
  // correct pick in the quarterfinals, semifinals and final.
  pickems: {
    event: "Worlds 2026 Pick'ems",
    score: 160,
    max: 160,
    favourite: "BLG",
    handle: "needSEinternship",
    rank: "Top 1% globally",
    total: 210,
    // Public, read-only view of the bracket on the official Pick'em site.
    verifyUrl:
      "https://lolesports.com/en-US/pickems/115660540725177488/picks/9145553020626820722/135815152855759183?sv=eFY0Kd0xuO" as
        | string
        | undefined,
    // The Polymarket position on the same run, from the public profile.
    bet: {
      market: "Will a team from LPL (China) win LoL Worlds 2026?",
      outcome: "Yes",
      shares: 139.2,
      price: 24.5,
      payout: 139.16,
      profit: 105.01,
      // Polymarket settles in US dollars. Shown in Canadian dollars at the
      // USD/CAD rate on the day the final was played.
      usdToCad: 1.427,
      rateDate: "Nov 14, 2026",
      // Moments on the price chart, in hours from the start of its history.
      events: [
        { hour: 570, label: "BLG beat T1" },
        { hour: 714, label: "BLG win Worlds" },
      ],
      url: "https://polymarket.com/@leojhli",
    } as
      | {
          market: string
          outcome: string
          shares: number
          price: number
          payout: number
          profit: number
          usdToCad: number
          rateDate: string
          events: { hour: number; label: string }[]
          url: string
        }
      | undefined,
    rounds: [
      {
        name: "Quarterfinals",
        matches: [
          { a: "DK", b: "BLG", sa: 0, sb: 3, points: 10 },
          { a: "KC", b: "T1", sa: 1, sb: 3, points: 10 },
          { a: "TES", b: "IG", sa: 1, sb: 3, points: 10 },
          { a: "GEN", b: "LYON", sa: 3, sb: 0, points: 10 },
        ],
      },
      {
        name: "Semifinals",
        matches: [
          { a: "BLG", b: "T1", sa: 3, sb: 1, points: 20 },
          { a: "IG", b: "GEN", sa: 0, sb: 3, points: 20 },
        ],
      },
      {
        name: "Final",
        matches: [{ a: "BLG", b: "GEN", sa: 3, sb: 1, points: 80 }],
      },
    ],
  },
  skills: [
    { label: "Languages", items: ["C++", "Python", "Java", "TypeScript", "JavaScript", "SQL", "C#", "HTML/CSS"] },
    { label: "Frameworks", items: ["React", "Node.js", "PyTorch", "Jupyter"] },
    { label: "Platforms", items: ["Git", "Unity"] },
  ],
  projects: [
    {
      id: "betago",
      landmark: "lighthouse",
      title: "BetaGo",
      accent: "#1f9d6b",
      preview: { kind: "video", src: "/projects/betago.mp4", poster: "/projects/betago.jpg", caption: "BetaGo playing itself" },
      summary:
        "A 9×9 Go engine with capture, suicide, ko, and area scoring rules, an interactive board, and seeded Monte Carlo tree search. A CPU policy/value network guides the neural search and trains through a resumable self-play pipeline. Optimizing liberty checks and board copying made search 2.7× faster (312 ms to 115 ms).",
      technologies: ["C++20", "MCTS", "CNN", "Tk"],
      points: [
        "Built a 9×9 Go engine with capture, suicide, ko, and area scoring rules; added an interactive Tk board and seeded classical MCTS search.",
        "Developed a CPU policy/value CNN to guide neural MCTS and a resumable self-play pipeline trained on search visits and game outcomes.",
        "Optimized liberty checks and board copying, reducing five 64-simulation searches from 312 ms to 115 ms (2.70×) and 32-move self-play from 1.75 s to 0.91 s (1.94×).",
      ],
      repoUrl: "https://github.com/leojhli/BetaGo",
      video: "/projects/betago.mp4",
      poster: "/projects/betago.jpg",
      mediaLabel:
        "Timelapse of the BetaGo board window: Monte Carlo tree search as Black plays a full 9×9 game against a random player.",
    },
    {
      id: "video-to-ascii",
      landmark: "observatory",
      title: "Video to ASCII",
      accent: "#0aa3b8",
      preview: { kind: "ascii", src: "/projects/cloister-clip.mp4", caption: "Live: video → ASCII" },
      summary:
        "A reusable React component that renders video as ASCII in real time. A two-pass WebGL2 pipeline matches glyphs by six regions and draws grids up to 500 columns wide at 30 FPS. It exports video in the browser at up to 1920 px, and 40 unit tests cover playback and export.",
      technologies: ["TypeScript", "React", "WebGL2", "GLSL"],
      points: [
        "Built a reusable video-to-ASCII component with a two-pass WebGL2 pipeline, using six-region glyph matching to render grids of up to 500 columns.",
        "Capped real-time playback at 30 FPS and reduced GPU overhead through texture reuse, offscreen suspension, and reliable WebGL context recovery.",
        "Implemented browser-local video export at up to 1920 px on the longest side; validated playback and export with 40 passing unit tests and Edge browser tests.",
      ],
      repoUrl: "https://github.com/leojhli/VideoToAscii",
      video: "/projects/cloister-clip.mp4",
      demo: "ascii",
    },
    {
      id: "did-you-even-listen",
      landmark: "rocket",
      title: "Did You Even Listen",
      accent: "#e0478f",
      summary:
        "An Obsidian plugin that records a lecture, transcribes it live with Groq Whisper, and compares your notes against AI-generated ones. It points out what is missing, incorrect, vague, or wordy through Socratic questions and quizzes, without handing over the answers.",
      technologies: ["TypeScript", "Obsidian API", "Groq", "esbuild"],
      points: [
        "Built an Obsidian plugin that records lectures, compares student notes with AI-generated notes, and provides targeted Socratic feedback to improve learning.",
        "Implemented real-time lecture transcription using Groq Whisper and AI-powered note analysis, metacognition assessment, and quiz generation using Llama 3.3.",
        "Designed structured JSON prompts and feedback workflows that identify missing, incorrect, vague, and verbose notes without directly revealing answers.",
      ],
    },
  ] as Project[],
  beyond: {
    intro:
      "Swimming has been a big part of my life, and I've also worked as a swim coach.",
    swimming: "[Swimming story]",
    coaching: "[Coaching details]",
    funFact: "[Fun fact]",
  },
  books,
  tracks,
  games: [
    { id: "lol", name: "League of Legends" },
    { id: "valorant", name: "Valorant" },
    { id: "roblox", name: "Roblox" },
    { id: "rocket", name: "Rocket League" },
    { id: "minecraft", name: "Minecraft" },
    { id: "gd", name: "Geometry Dash" },
    { id: "clash", name: "Clash Royale" },
    { id: "brawl", name: "Brawl Stars" },
    { id: "poker", name: "Poker" },
    { id: "chess", name: "Chess" },
  ] as Game[],
}

export type Content = typeof content
export function getContent(): Content {
  return content
}

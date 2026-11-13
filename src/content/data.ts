// Any [bracketed] value is unfilled and hidden by the site. Books and music live in ./library.
// Replace values here (or swap getContent() for a CMS/API adapter later).
import { books, tracks } from "./library"

export type ContactId = "linkedin" | "github" | "resume" | "email" | "x" | "instagram"
export type Contact = {
  id: ContactId
  label: string
  href?: string
}
export type Experience = {
  id: string
  role: string
  organization: string
  /** Square logo in public/, shown beside the organization. */
  logo?: string
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
      url: "https://www.linkedin.com/company/uwrealitylabs/",
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
    degree: "Bachelor of Applied Science in Computer Engineering",
    dates: "Sep 2026 – Apr 2031",
    coursework: ["Fundamentals of Programming (C++)", "Linear Algebra", "Calculus I"],
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

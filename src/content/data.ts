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
  dates: string
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
      "I'm a first-year computer engineering student. Right now I research efficient attention for Transformers and build data tooling for gesture recognition at UW Reality Labs.",
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
      organization: "University of Waterloo, Fast Multipole Attention",
      dates: "Nov 2026 – Present",
      points: [
        "Investigating Fast Multipole Attention with Professor Giang Tran: Transformer architectures that cut the computational cost of standard self-attention.",
        "Implementing FlashAttention with blockwise computation and online softmax, which lowers GPU memory use by never materializing the full attention matrix.",
      ],
    },
    {
      id: "uw-reality-labs",
      role: "Software Engineer",
      organization: "UW Reality Labs",
      dates: "Sep 2026 – Present",
      points: [
        "Built a Python validation tool for gesture-recognition datasets. It audited 372 recordings across 22 JSON files and reports each data-quality issue with its exact source location.",
        "Wrote 5 dataset checks covering missing sequence and confidence fields, empty recording lists, invalid record types, and empty recording objects.",
        "Implemented sliding-window segmentation, confidence filtering, and sequence padding to prepare gesture data for ML training.",
      ],
    },
  ] as Experience[],
  projects: [
    {
      id: "betago",
      landmark: "lighthouse",
      title: "BetaGo",
      summary:
        "A 9×9 Go engine with capture, suicide, ko, and area scoring rules, an interactive board, and seeded Monte Carlo tree search. A CPU policy/value network guides the neural search and trains through a resumable self-play pipeline. Optimizing liberty checks and board copying made search 2.7× faster (312 ms to 115 ms).",
      technologies: ["C++20", "MCTS", "CNN", "Tk"],
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

// Every [bracketed] value is intentionally unfilled. Books and music live in ./library.
// Replace values here (or swap getContent() for a CMS/API adapter later).
import { books, tracks } from "./library"

export type ContactId = "linkedin" | "github" | "resume" | "email"
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
    intro: "[Short introduction — replace with actual bio]",
    headline: "Computer Engineering @ University of Waterloo",
    portrait: undefined as string | undefined,
  },
  // Add href values when real destinations exist. Missing hrefs render as "not yet linked".
  contacts: [
    { id: "linkedin", label: "LinkedIn" },
    { id: "github", label: "GitHub" },
    { id: "resume", label: "Résumé" },
    { id: "email", label: "Email" },
  ] as Contact[],
  experience: [
    {
      id: "exp-1",
      role: "[Role]",
      organization: "[Organization]",
      dates: "[Dates]",
      points: ["[Achievement — placeholder]", "[Responsibility — placeholder]"],
    },
    {
      id: "exp-2",
      role: "[Role]",
      organization: "[Organization]",
      dates: "[Dates]",
      points: ["[Achievement — placeholder]"],
    },
  ] as Experience[],
  projects: [
    {
      id: "p-1",
      landmark: "lighthouse",
      title: "[Project title]",
      summary: "[Summary]",
      technologies: ["[Technologies]"],
    },
    {
      id: "p-2",
      landmark: "observatory",
      title: "[Project title]",
      summary: "[Summary]",
      technologies: ["[Technologies]"],
    },
    {
      id: "p-3",
      landmark: "rocket",
      title: "[Project title]",
      summary: "[Summary]",
      technologies: ["[Technologies]"],
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

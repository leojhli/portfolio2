/** Four addresses in Rain District, connected to the existing portfolio. */
export const spiritStops = [
  {
    id: "experience",
    name: "Dispatch Workshop",
    subtitle: "The work that keeps the city moving.",
    position: [-5.6, 1.8, -7],
    camera: [-14, 5, 1],
    character: "调度工坊",
    note: "A bench full of tools. A problem worth staying up for.",
  },
  {
    id: "projects",
    name: "Signal Archive",
    subtitle: "Experiments, transmitted and received.",
    position: [5.6, 1.8, -15],
    camera: [14, 5, -7],
    character: "信号档案",
    note: "Some ideas arrive as static. Keep listening.",
  },
  {
    id: "about",
    name: "After-hours Tea House",
    subtitle: "A little life beyond the screen.",
    position: [-5.6, 1.8, 9],
    camera: [-14, 5, 16],
    character: "深夜茶室",
    note: "The kettle is on. There is time for one more story.",
  },
  {
    id: "contact",
    name: "Last Tram",
    subtitle: "Every good conversation goes somewhere.",
    position: [5.2, 1.8, 19],
    camera: [11, 4, 25],
    character: "末班电车",
    note: "Meet me under the departure board.",
  },
] as const

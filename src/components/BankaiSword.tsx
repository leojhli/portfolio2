import { usePrefs } from "../state/preferences"

/** Original silhouette of the slim black Bankai katana, not the broad Shikai blade. */
export default function BankaiSword() {
  const { mode } = usePrefs()
  if (mode === "ascii")
    return (
      <pre aria-hidden="true" className="bankai-ascii">
        {
          "        /\n       /|\n       ||\n       ||\n       ||\n       ||\n       ||\n       ||\n     +-++\n      +++-+\n       ##\n       ##\n       ##\n        o\n       o\n        o"
        }
      </pre>
    )
  return (
    <svg
      className="bankai-sword"
      viewBox="0 0 120 440"
      fill="none"
      aria-hidden="true"
    >
      <path
        className="bankai-blade"
        d="M67 18C75 100 69 200 59 304L48 303C59 194 66 101 61 38Z"
        fill="#08090d"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M67 21C73 113 65 225 57 301"
        stroke="#a8b9d0"
        strokeOpacity=".75"
      />
      <path
        d="M48 304H67V319H60V311H53V326H38V319H46V312H31V297H38V305H45V290H60V297H52V304Z"
        fill="#08090d"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M47 323H58L54 392H43Z"
        fill="#0b0c10"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <path
          key={i}
          d={`M${47 - i * 0.4} ${328 + i * 9}l8 5-9 4`}
          stroke="#8995a7"
          strokeWidth="1.2"
        />
      ))}
      <path d="M42 389H56V395H42Z" fill="#15171e" stroke="currentColor" />
      <g stroke="currentColor" strokeWidth="1.7">
        <ellipse cx="49" cy="402" rx="3" ry="6" />
        <ellipse cx="46" cy="412" rx="3" ry="6" transform="rotate(25 46 412)" />
        <ellipse cx="41" cy="421" rx="3" ry="6" transform="rotate(30 41 421)" />
        <ellipse cx="34" cy="428" rx="3" ry="6" transform="rotate(60 34 428)" />
      </g>
    </svg>
  )
}

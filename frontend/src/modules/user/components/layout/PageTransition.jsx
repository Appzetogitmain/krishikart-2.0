// Pages are shown immediately. Fading a page in from invisible left one blank frame between
// screens, which showed up on phones as a flicker when switching tabs.
export default function PageTransition({ children }) {
    return <div>{children}</div>
}

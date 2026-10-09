import { projects } from './projects'

// Copy is checked against the owned README snapshots in handoff-v10 and the
// current catalogue. Links come from that catalogue, never a second URL list.
const copy: Record<string, { overview: string; details: string[] }> = {
  '1357004367': {
    overview:
      'Pelagic is an interactive WebGL ocean with procedural jellyfish. Explore follows the portfolio’s descent into the live Pelagic experience.',
    details: [
      'The jellyfish deform and swim through a current-coupled ocean in real time.',
      'Underwater lighting, thermal shimmer and optical effects sample the living scene.',
    ],
  },
  '1355818842': {
    overview:
      'My Arch Linux desktop, built around Hyprland and Quickshell. Kona brings its configuration, controls and recovery tools together.',
    details: [
      'A Linux desktop configuration and tooling project.',
      'The preview shows the actual desktop; its repository contains the setup and recovery instructions.',
    ],
  },
  '1367284706': {
    overview:
      'A developer tool for bounded delegation from Codex to Hermes. Codex keeps final authority and verifies the returned work.',
    details: [
      'Deterministic tools run first, with suitable work routed to a FAST or STRONG worker.',
      'Configuration and terminal tools define authority and worker limits.',
    ],
  },
  '1353607509': {
    overview:
      'janktrace finds main-thread stalls in Chrome performance traces. It streams the trace and reports long tasks and their likely causes.',
    details: [
      'Selects the renderer main thread from recorded DevTools trace JSON.',
      'No runtime dependencies, and no need to load the entire trace into memory.',
    ],
  },
  '1388326955': {
    overview:
      'A photographed farm website demonstration, with a catalogue and sample basket. It explores how a local grower’s website can feel and work.',
    details: [
      'A fictional farm with product variants, collection previews and licensed farm-life footage.',
      'The basket and visiting note are demonstrations; the site does not accept orders, payments or bookings.',
    ],
  },
  '1375135091': {
    overview:
      'My C++ solutions to Open Kattis problems. A collection of programming practice and problem-solving work.',
    details: [
      'Competitive-programming solutions, available as source in the repository.',
      'The preview follows the project’s actual source and test flow.',
    ],
  },
  '1352586659': {
    overview:
      'This portfolio brings my projects together with real previews and interactive motion. Its intro and selection reel lead into the Pelagic journey.',
    details: [
      'The live reel contains eight projects, with their own media and resource links.',
      'The source includes the typography intro, reversible descent and accessible controls.',
    ],
  },
  '1353608040': {
    overview:
      'The README introducing my public GitHub work. It connects my profile to the projects and experiences I build.',
    details: [
      'A documentation project in the Denoax/Denoax repository.',
      'Links connect the profile to the portfolio, Pelagic and other public projects.',
    ],
  },
}
export function projectHelp(id: string) {
  const project = projects.find((p) => p.id === id)
  if (!project || !copy[id]) throw new Error(`Missing project help: ${id}`)
  return { project, ...copy[id] }
}

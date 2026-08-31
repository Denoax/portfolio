export interface Chapter {
  id: string
  number: string
  label: string
  eyebrow: string
  title: string
  titleSecondary?: string
  description?: string
  align: 'left' | 'right'
}

export const chapters: Chapter[] = [
  {
    id: 'signal',
    number: '00',
    label: 'SIGNAL',
    eyebrow: '49.6956 N / LETHBRIDGE, CANADA',
    title: 'MANI',
    titleSecondary: 'MARAMI MILANI',
    description: 'COMPUTER SCIENCE × MATHEMATICS',
    align: 'left',
  },
  {
    id: 'identity',
    number: '01',
    label: 'IDENTITY',
    eyebrow: 'SYSTEMS / DATA / AUTOMATION',
    title: 'INFORMATION',
    titleSecondary: 'UNDER GRAVITY',
    description: 'I work where software, data and infrastructure meet.',
    align: 'right',
  },
  {
    id: 'history',
    number: '02',
    label: 'ORBITAL HISTORY',
    eyebrow: 'AGRICULTURE & AGRI-FOOD CANADA / LETHBRIDGE, ALBERTA',
    title: 'THREE',
    titleSecondary: 'ORBITAL STATES',
    description: 'Scientific data evolved into automation, pipelines and production infrastructure.',
    align: 'left',
  },
  {
    id: 'infrastructure',
    number: '03',
    label: 'INFRASTRUCTURE',
    eyebrow: 'TRACE / VALIDATE / TEST / AUTOMATE / REPORT',
    title: 'COMPLEXITY',
    titleSecondary: 'MADE DETERMINISTIC',
    description: 'Runtime paths, legacy data and CI/CD reorganized into systems that can be understood and trusted.',
    align: 'right',
  },
  {
    id: 'algorithm',
    number: '04',
    label: 'ALGORITHM FIELD',
    eyebrow: 'ICPC / 2024–2025 / UNIVERSITY OF CALGARY',
    title: 'ONE PATH',
    titleSecondary: 'RESOLVES',
    description: 'Regional contestant. Top 10. Three-person team.',
    align: 'left',
  },
  {
    id: 'education',
    number: '05',
    label: 'DUAL SYSTEM',
    eyebrow: 'UNIVERSITY OF LETHBRIDGE / SEPTEMBER 2023–CURRENT',
    title: 'COMPUTATION',
    titleSecondary: '× MATHEMATICS',
    description: 'BSc Computer Science. Dual Degree Mathematics. Co-operative Education.',
    align: 'right',
  },
  {
    id: 'human',
    number: '06',
    label: 'HUMAN SIGNAL',
    eyebrow: 'BEYOND THE SYSTEM',
    title: 'DISTANT',
    titleSecondary: 'SIGNALS',
    description: 'Soccer. Track & field. Piano. Recorder. Gaming.',
    align: 'left',
  },
  {
    id: 'horizon',
    number: '07',
    label: 'HORIZON',
    eyebrow: 'LETHBRIDGE, ALBERTA, CANADA',
    title: 'THE NEXT',
    titleSecondary: 'PROBLEM',
    description: 'The field resolves. The work continues.',
    align: 'right',
  },
]

export const careerAnchors = [
  {
    period: '2023 — 2025',
    role: 'FSWEP',
    detail: 'SCIENTIFIC DATA / HERBARIUM DIGITIZATION / DARWIN CORE / R-SHINY / BIOINFORMATICS / DATA QUALITY',
  },
  {
    period: 'JAN — APR 2026',
    role: 'CO-OP I',
    detail: 'GITLAB CI/CD / SELF-HOSTED RUNNERS / TESTING / ETL / SCHEMA VALIDATION / AUTOMATION / PYTHON',
  },
  {
    period: 'MAY — AUG 2026',
    role: 'CO-OP II',
    detail: 'LEGACY SCIENTIFIC INFRASTRUCTURE / SAS + PYTHON / SERVER MIGRATION / RUNTIME TRACING / DATA LINEAGE / PRODUCTION TRIAGE / AUTOMATED REPORTING',
  },
]

export const infrastructureSignals = [
  'INGEST',
  'TRACE',
  'VALIDATE',
  'TEST',
  'AUTOMATE',
  'REPORT',
]

export const algorithmSignals = [
  'DATA STRUCTURES',
  'GRAPH ALGORITHMS',
  'DYNAMIC PROGRAMMING',
  'GREEDY METHODS',
  'DEBUGGING',
  'COMPLEXITY ANALYSIS',
]

export const humanSignals = [
  { title: 'SOCCER', detail: 'THREE YEARS / TIER-1 LFC / LETHBRIDGE' },
  { title: 'TRACK & FIELD', detail: 'LONG + TRIPLE JUMP / SOUTHERN ALBERTA 1ST + 2ND / 7TH PROVINCIALLY' },
  { title: 'MUSIC', detail: 'PIANO / RECORDER' },
  { title: 'GAMING', detail: '' },
]

export const contact = {
  email: 'mani.maramimilani@uleth.ca',
  linkedin: 'https://ca.linkedin.com/in/mani-marami-milani-8713a7309',
}

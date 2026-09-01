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
    align: 'right',
  },
  {
    id: 'history',
    number: '02',
    label: 'ORBITAL HISTORY',
    eyebrow: 'AGRICULTURE & AGRI-FOOD CANADA / LETHBRIDGE, ALBERTA',
    title: 'THREE',
    titleSecondary: 'ORBITAL STATES',
    align: 'left',
  },
  {
    id: 'infrastructure',
    number: '03',
    label: 'INFRASTRUCTURE',
    eyebrow: 'TRACE / VALIDATE / TEST / AUTOMATE / REPORT',
    title: 'COMPLEXITY',
    titleSecondary: 'MADE DETERMINISTIC',
    align: 'right',
  },
  {
    id: 'algorithm',
    number: '04',
    label: 'ALGORITHM FIELD',
    eyebrow: 'ICPC / 2024–2025 / UNIVERSITY OF CALGARY',
    title: 'ONE PATH',
    titleSecondary: 'RESOLVES',
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
    align: 'left',
  },
  {
    id: 'horizon',
    number: '07',
    label: 'HORIZON',
    eyebrow: 'LETHBRIDGE, ALBERTA, CANADA',
    title: 'THE NEXT',
    titleSecondary: 'SOLUTION',
    description: 'MANI MARAMI MILANI\nComputer Science × Mathematics\nLethbridge, Alberta, Canada',
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

export const humanSignals = [
  { value: 'TOP 10', label: 'ICPC REGIONAL', detail: 'THREE-PERSON TEAM / UNIVERSITY OF CALGARY' },
  { value: '2023-26', label: 'DEVELOPER FOR THE GOVERNMENT OF CANADA', detail: 'FSWEP + TWO CO-OP TERMS' },
]

export const contact = {
  email: 'mani.maramimilani@uleth.ca',
  github: 'https://github.com/Denoax',
}

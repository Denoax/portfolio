import {
  careerAnchors,
  chapters,
  contact,
  humanSignals,
} from '../content/portfolio'

interface ChapterLayerProps {
  index: number
  onCopyEmail: () => void
  emailCopied: boolean
}

function ChapterDetails({ index, onCopyEmail, emailCopied }: ChapterLayerProps) {
  if (index === 2) {
    return (
      <ol className="career-orbits" aria-label="Agriculture and Agri-Food Canada experience">
        {careerAnchors.map((anchor, anchorIndex) => (
          <li key={anchor.role}>
            <span className="career-orbits__index">0{anchorIndex + 1}</span>
            <time>{anchor.period}</time>
            <strong>{anchor.role}</strong>
            <p>{anchor.detail}</p>
          </li>
        ))}
      </ol>
    )
  }

  if (index === 5) {
    return (
      <div className="dual-degree" aria-label="Education">
        <div><span>01</span><strong>BSc COMPUTER SCIENCE</strong></div>
        <i aria-hidden="true">×</i>
        <div><span>02</span><strong>DUAL DEGREE MATHEMATICS</strong></div>
      </div>
    )
  }

  if (index === 6) {
    return (
      <ul className="human-signals" aria-label="Selected resume highlights">
        {humanSignals.map((signal) => (
          <li key={signal.label}>
            <strong>{signal.value}</strong>
            <span>{signal.label}</span>
            <small>{signal.detail}</small>
          </li>
        ))}
      </ul>
    )
  }

  if (index === 7) {
    return (
      <div className="contact-links">
        <button type="button" onClick={onCopyEmail} aria-label="Copy Mani's email address">
          <span>{emailCopied ? 'EMAIL COPIED' : contact.email}</span>
          <i aria-hidden="true">{emailCopied ? '✓' : '↗'}</i>
        </button>
        <a href={contact.github} target="_blank" rel="noreferrer">
          <span>GITHUB</span>
          <i aria-hidden="true">↗</i>
        </a>
      </div>
    )
  }

  return null
}

export function ChapterLayer(props: ChapterLayerProps) {
  const chapter = chapters[props.index]
  return (
    <section
      id={chapter.id}
      className={`chapter chapter--${chapter.align} chapter--${chapter.id}`}
      aria-label={`${chapter.number} ${chapter.label}`}
    >
      <div className="chapter__layer" data-chapter-layer>
        <h2 className="chapter__title">
          <span>{chapter.title}</span>
          {chapter.titleSecondary && <span>{chapter.titleSecondary}</span>}
        </h2>
        {chapter.description && <p className="chapter__description">{chapter.description}</p>}
        <ChapterDetails {...props} />
      </div>
    </section>
  )
}

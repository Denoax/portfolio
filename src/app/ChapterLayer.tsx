import {
  algorithmSignals,
  careerAnchors,
  chapters,
  contact,
  humanSignals,
  infrastructureSignals,
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

  if (index === 3 || index === 4) {
    const signals = index === 3 ? infrastructureSignals : algorithmSignals
    return (
      <ul className="signal-list" aria-label={`${chapters[index].label} concepts`}>
        {signals.map((signal, signalIndex) => (
          <li key={signal}>
            <span>{String(signalIndex + 1).padStart(2, '0')}</span>
            {signal}
          </li>
        ))}
      </ul>
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
      <ul className="human-signals" aria-label="Interests">
        {humanSignals.map((signal) => (
          <li key={signal.title}>
            <strong>{signal.title}</strong>
            {signal.detail && <span>{signal.detail}</span>}
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
        <a href={contact.linkedin} target="_blank" rel="noreferrer">
          <span>LINKEDIN</span>
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
        <div className="chapter__eyebrow">
          <span>{chapter.number}</span>
          <span>{chapter.eyebrow}</span>
        </div>
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

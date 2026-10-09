import { useEffect } from 'react'
import '../styles/case-study.css'

const source = 'https://github.com/Denoax/pelagic-jellyfish-webgl'
const demo = 'https://denoax.github.io/pelagic-jellyfish-webgl/'

export function PelagicCaseStudy() {
  useEffect(() => {
    const previousTitle = document.title
    document.title = 'Pelagic — Project case study | Mani Marami Milani'
    return () => {
      document.title = previousTitle
    }
  }, [])

  return (
    <div className="case-site">
      <a className="skip-link" href="#case-content">
        Skip to case study
      </a>
      <header className="case-header">
        <a href="/" className="case-header__name">
          MANI MARAMI MILANI
        </a>
        <a href="/#worlds" className="case-header__back">
          ← WORLDS
        </a>
      </header>
      <main id="case-content">
        <article>
          <div className="case-hero">
            <div className="case-hero__copy">
              <p className="case-kicker">
                Selected work <span>Creative development · WebGL</span>
              </p>
              <h1>
                PELAGIC<span>Inside a living ocean.</span>
              </h1>
              <p className="case-hero__intro">
                A silent descent through a procedural jellyfish ocean. Movement,
                anatomy, water, and light work together as one browser
                experience.
              </p>
              <div className="case-actions">
                <a href={demo} target="_blank" rel="noreferrer">
                  Enter the experience ↗
                </a>
                <a href={source} target="_blank" rel="noreferrer">
                  View source ↗
                </a>
              </div>
            </div>
            <figure className="case-hero__image">
              <picture>
                <source
                  media="(max-width: 720px), (max-aspect-ratio: 82/100)"
                  srcSet="/assets/projects/pelagic-portrait.webp"
                />
                <img
                  src="/assets/projects/pelagic-ocean.webp"
                  alt="Pelagic's translucent jellyfish travelling through a dark ocean"
                  width="1920"
                  height="1200"
                  fetchPriority="high"
                />
              </picture>
            </figure>
          </div>

          <div className="case-body">
            <div className="case-facts" aria-label="Project facts">
              <div>
                <span>FORMAT</span>
                <strong>Interactive WebGL experience</strong>
              </div>
              <div>
                <span>CORE</span>
                <strong>Three.js · procedural geometry · shaders</strong>
              </div>
              <div>
                <span>ROLE</span>
                <strong>Independent project by Mani Marami Milani</strong>
              </div>
            </div>

            <section className="case-section" aria-labelledby="case-idea">
              <p className="case-section__index">01 / THE IDEA</p>
              <div>
                <h2 id="case-idea">Make the ocean feel alive.</h2>
                <p>
                  Pelagic follows an authored journey into a basalt sanctuary.
                  The jellyfish are rendered as living forms: a bell, rim, oral
                  membranes, and tentacles that change shape as each animal
                  swims. The scene remains interactive as the camera travels
                  from open water into the deep.
                </p>
              </div>
            </section>

            <figure className="case-media">
              <img
                src="/assets/projects/pelagic-ocean.webp"
                alt="A clean capture of Pelagic's procedural jellyfish and underwater light"
                width="1920"
                height="1200"
                loading="lazy"
              />
              <figcaption>
                02 / Captured from the original project.{' '}
                <a href={demo} target="_blank" rel="noreferrer">
                  Explore the living scene ↗
                </a>
              </figcaption>
            </figure>

            <section className="case-section" aria-labelledby="case-motion">
              <p className="case-section__index">02 / THE SYSTEM</p>
              <div>
                <h2 id="case-motion">A pulse has consequences.</h2>
                <p>
                  The swim cycle separates contraction, refill, and coast. Its
                  thrust changes the animal's translation, while constrained
                  point histories let appendages lag and settle through body
                  turns. Nearby water responds through a bounded current field,
                  connecting animal movement to the environment.
                </p>
                <a
                  className="case-text-link"
                  href={`${source}/blob/main/src/scene/jellyMotion.js`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Read the motion implementation ↗
                </a>
              </div>
            </section>

            <section className="case-section" aria-labelledby="case-budget">
              <p className="case-section__index">03 / THE CONSTRAINT</p>
              <div>
                <h2 id="case-budget">Keep depth without multiplying cost.</h2>
                <p>
                  Near, medium, and far jellyfish share their motion state while
                  changing visual detail with projected screen size. The
                  renderer keeps one primary ocean target; bubbles, refraction,
                  and the idle liquid treatment use that scene output instead of
                  building separate oceans.
                </p>
                <p>
                  That choice preserves continuity as the camera moves between
                  scales. It is a rendering design decision, not a claim of a
                  fixed frame rate on every device.
                </p>
                <a
                  className="case-text-link"
                  href={`${source}/tree/main/src/scene/population`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Explore the population system ↗
                </a>
              </div>
            </section>

            <div className="case-ending">
              <p>See the system in motion.</p>
              <a href={demo} target="_blank" rel="noreferrer">
                Enter Pelagic <span aria-hidden="true">↗</span>
              </a>
            </div>
          </div>
        </article>
      </main>
      <footer className="case-footer">
        <a href="/#worlds">← Return to worlds</a>
        <span>MANI MARAMI MILANI / 2026</span>
      </footer>
    </div>
  )
}

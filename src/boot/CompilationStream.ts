// CSS starts from the prepainted shell before this adapter or React loads.
// This owner only pauses/retires the bounded strip; it never declares readiness.
export class CompilationStream {
  private retired = false
  private readonly strip: HTMLElement
  constructor(shell: HTMLElement) {
    this.strip = shell.querySelector<HTMLElement>('.terminal-stream')!
    document.addEventListener('visibilitychange', this.visibility)
    this.visibility()
  }
  private visibility = () => {
    this.strip.style.animationPlayState = document.hidden || this.retired ? 'paused' : ''
  }
  retire() {
    this.retired = true
    this.visibility()
  }
  dispose() {
    this.retire()
    document.removeEventListener('visibilitychange', this.visibility)
  }
}

export class NoRepeatBag<T> {
  private pending: T[] = []
  private last: T | undefined
  constructor(
    private readonly values: readonly T[],
    private readonly random = Math.random,
  ) {
    if (values.length < 2 || new Set(values).size !== values.length)
      throw new Error('A shuffle bag requires two distinct values')
  }
  next(): T {
    if (!this.pending.length) {
      this.pending = [...this.values]
      for (let i = this.pending.length - 1; i > 0; i--) {
        const j = Math.floor(this.random() * (i + 1))
        ;[this.pending[i], this.pending[j]] = [this.pending[j], this.pending[i]]
      }
      const end = this.pending.length - 1
      if (this.pending[end] === this.last)
        [this.pending[0], this.pending[end]] = [
          this.pending[end],
          this.pending[0],
        ]
    }
    return (this.last = this.pending.pop()!)
  }
}

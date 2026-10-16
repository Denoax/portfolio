// Copyright (c) 2026 Swami Malode. Adapted RareUI Fluid Orb, pin b4de46e.
// MIT + Commons Clause + Attribution: /assets/notices/rareui-license.txt.
import { useEffect, useRef, useState } from 'react'
import { orbVertex, orbFragment } from './fluidOrbShader'
import type { ResolvedTheme } from '../../core/theme'

export function FluidThemeOrb({ theme }: { theme: ResolvedTheme }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const themeRef = useRef(theme)
  themeRef.current = theme
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    const el = canvas.current!,
      gl = el.getContext('webgl', { alpha: true, antialias: true })
    if (!gl) {
      setFailed(true)
      return
    }
    const shaders: WebGLShader[] = []
    const program = gl.createProgram()!,
      buffer = gl.createBuffer()!
    let raf = 0,
      last = 0,
      time = 0,
      shell = themeRef.current === 'dark' ? 1 : 0,
      visible = true,
      alive = true,
      lost = false
    const reduce = matchMedia('(prefers-reduced-motion: reduce)')
    const cleanup = () => {
      cancelAnimationFrame(raf)
      gl.deleteProgram(program)
      shaders.forEach((s) => gl.deleteShader(s))
      gl.deleteBuffer(buffer)
    }
    try {
      for (const [kind, source] of [
        [gl.VERTEX_SHADER, orbVertex],
        [gl.FRAGMENT_SHADER, orbFragment],
      ] as const) {
        const s = gl.createShader(kind)!
        shaders.push(s)
        gl.shaderSource(s, source)
        gl.compileShader(s)
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
          throw Error(gl.getShaderInfoLog(s) ?? 'Orb shader compilation failed')
        gl.attachShader(program, s)
      }
      gl.linkProgram(program)
      if (!gl.getProgramParameter(program, gl.LINK_STATUS))
        throw Error(
          gl.getProgramInfoLog(program) ?? 'Orb program linking failed',
        )
    } catch (error) {
      console.warn(
        'Fluid Orb unavailable; semantic theme fallback retained',
        error,
      )
      cleanup()
      setFailed(true)
      return
    }
    const position = gl.getAttribLocation(program, 'a_pos'),
      resolution = gl.getUniformLocation(program, 'u_resolution'),
      clock = gl.getUniformLocation(program, 'u_time'),
      clear = gl.getUniformLocation(program, 'u_darkShell')
    gl.useProgram(program)
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    )
    gl.enableVertexAttribArray(position)
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)
    gl.uniform3f(gl.getUniformLocation(program, 'u_color'), 0, 0, 0)
    const draw = (now: number) => {
      raf = 0
      if (!alive || lost) return
      const active =
        visible && !document.hidden && !document.querySelector('dialog:modal')
      const dt = active && last ? Math.min(0.05, (now - last) / 1000) : 0
      last = active ? now : 0
      if (active && !reduce.matches) time += dt
      shell +=
        (Number(themeRef.current === 'dark') - shell) *
        (reduce.matches ? 1 : 1 - Math.exp(-dt / 0.12))
      const px = Math.round(el.clientWidth * Math.min(devicePixelRatio || 1, 2))
      if (el.width !== px || el.height !== px) {
        el.width = el.height = px
        gl.viewport(0, 0, px, px)
        gl.uniform2f(resolution, px, px)
      }
      gl.uniform1f(clock, reduce.matches ? 0 : time)
      gl.uniform1f(clear, shell)
      gl.drawArrays(gl.TRIANGLES, 0, 6)
      el.dataset.time = String(time)
      el.dataset.active = String(active && !reduce.matches)
      if (active && !reduce.matches) raf = requestAnimationFrame(draw)
    }
    const wake = () => {
      last = 0
      if (!raf && !lost) raf = requestAnimationFrame(draw)
    }
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      cancelAnimationFrame(raf)
      raf = 0
      wake()
    })
    observer.observe(el)
    const mutations = new MutationObserver(wake)
    mutations.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-color-theme'],
    })
    mutations.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ['open'],
    })
    const loss = (e: Event) => {
      e.preventDefault()
      lost = true
      cancelAnimationFrame(raf)
      raf = 0
      setFailed(true)
    }
    el.addEventListener('webglcontextlost', loss)
    document.addEventListener('visibilitychange', wake)
    reduce.addEventListener('change', wake)
    window.addEventListener('resize', wake)
    wake()
    return () => {
      alive = false
      observer.disconnect()
      mutations.disconnect()
      el.removeEventListener('webglcontextlost', loss)
      document.removeEventListener('visibilitychange', wake)
      reduce.removeEventListener('change', wake)
      window.removeEventListener('resize', wake)
      cleanup()
    }
  }, [])
  return (
    <span className="fluid-theme-orb" data-failed={failed}>
      <canvas ref={canvas} aria-hidden="true" />
      {failed && <span aria-hidden="true">{theme === 'dark' ? '◐' : '◑'}</span>}
    </span>
  )
}


import "./Button.css"

import { useState } from "react"

export const Button = ({ emitter }) => {
  const [state, setState] = useState(0)
  return (
    <div>
      <button id='click-btn' className='shared-btn' onClick={() => {
        const next = state + 1
        setState(next)
        if (next % 5 === 0) emitter?.emit('button:clicked', { count: next })
      }}>Click me: {state}</button>
    </div>
  )
}

export default Button

import "./Button.css"

import { useAtom } from "jotai"
import { clickCountAtom } from "@webpack-host/store"

const Button = () => {
  const [state, setState] = useAtom(clickCountAtom);
  return (
    <div>
      <button id='click-btn' className='shared-btn' onClick={() => setState((s) => s + 1)}>Click me: {state}</button>
    </div>
  )
}

export default Button;
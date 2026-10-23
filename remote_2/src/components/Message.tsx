import { useAtomValue } from 'jotai'
import { clickCountAtom } from '@webpack-host/store'

const Message = () => {
  const clickCount = useAtomValue(clickCountAtom);

  if (clickCount < 5) {
    return null;
  }
  return <div>So many clicking, you need to stop</div>
}

export default Message;
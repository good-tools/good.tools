import { useState } from "react";
import { md } from "node-forge"
import TextInput from "../components/TextInput"

function HashCalculator() {
  const [ input, setInput ] = useState('')

  const hash = (digest, input) => {
    digest.update(input);
    return digest.digest().toHex();
  }

  return (
    <div>
      <div className="py-2 font-bold">
        Input
      </div>
      <TextInput
        type="text"
        name="value"
        id="value"
        className={"w-full"}
        value={input}
        onChange={(e) => setInput(e.target.value)}
      />
      <div className="mt-4 grid grid-cols-1 gap-x-4 gap-y-4 md:grid-cols-2">
        {Object.keys(md.algorithms).map(a => (
          <div>
            <div className="py-2 font-bold">
              {a.toUpperCase()}
            </div>
            <TextInput
              key={a}
              type="text"
              name={a}
              disabled
              className={"w-full"}
              value={hash(md.algorithms[a].create(), input)}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

export default HashCalculator;
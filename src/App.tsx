import { useState } from "react";
import LexicalRichText from "./components/LexicalRichText";

function App() {
  const [value, setValue] = useState("");

  console.log(value);

  return (
    <div style={{ gap: "1rem" }}>
      <LexicalRichText value={value} setValue={setValue} />
    </div>
  );
}

export default App;

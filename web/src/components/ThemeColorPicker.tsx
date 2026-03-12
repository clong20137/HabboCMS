
import { useState } from "react";

export default function ThemeColorPicker({primary,secondary,onChange}:{primary:string,secondary:string,onChange:(p:string,s:string)=>void}){

const [p,setP]=useState(primary);
const [s,setS]=useState(secondary);

function update(np:string,ns:string){
 setP(np);
 setS(ns);
 onChange(np,ns);
}

return(
<div style={{display:"flex",gap:20}}>
<div>
<div>Primary</div>
<input type="color" value={p} onChange={e=>update(e.target.value,s)} />
</div>
<div>
<div>Secondary</div>
<input type="color" value={s} onChange={e=>update(p,e.target.value)} />
</div>
</div>
);
}

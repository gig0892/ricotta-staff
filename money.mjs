// Currency is settled in integer cents. Durations keep millisecond precision.
export const cents = n => {if(!Number.isFinite(+n))throw new Error('invalid_amount');return Math.round((+n+Number.EPSILON)*100);};
export const dollars = n => n/100;
export function roundRatio(n,d) {
 if(n<0n||d<=0n)throw new Error('invalid_amount');
 return Number((n*2n+d)/(d*2n));
}
export function payUnits(hours,wage,multiplier=1) {
 const ms=BigInt(Math.round(hours*3600000)),rate=BigInt(cents(wage)),mult=BigInt(Math.round(multiplier*10000));
 return ms*rate*mult;
}
export const PAY_DENOMINATOR=36000000000n;
export const settlePay=units=>roundRatio(units,PAY_DENOMINATOR);
export function allocateCents(pool,weights) {
 const total=cents(pool), entries=Object.entries(weights).filter(([,w])=>Number.isFinite(w)&&w>0).sort(([a],[b])=>a.localeCompare(b));
 if(!entries.length)return {};
 const ws=entries.map(([id,w])=>({id,w:BigInt(Math.round(w*3600000))}));
 const den=ws.reduce((s,x)=>s+x.w,0n);
 if(!den)return {};
 const rows=ws.map(x=>{const n=BigInt(total)*x.w;return {...x,n:Number(n/den),rem:n%den};});
 let rest=total-rows.reduce((s,x)=>s+x.n,0);
 rows.sort((a,b)=>a.rem===b.rem?a.id.localeCompare(b.id):a.rem>b.rem?-1:1);
 for(let i=0;i<rest;i++)rows[i%rows.length].n++;
 return Object.fromEntries(rows.map(x=>[x.id,x.n/100]));
}

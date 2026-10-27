/** Shared routing policy. Availability and workload are supplied by each channel. */
export function selectAttendantIndex(team:string[],available:number[],loads:Record<string,number>,cursor=-1){
 const eligible=new Set(available.filter(i=>Number.isInteger(i)&&i>=0&&i<team.length));
 if(!eligible.size)return null;
 const minimum=Math.min(...team.map((name,i)=>eligible.has(i)?Number(loads[name]||0):Infinity));
 return Array.from({length:team.length},(_,step)=>(cursor+1+step+team.length)%team.length)
  .find(i=>eligible.has(i)&&Number(loads[team[i]]||0)===minimum)??null;
}

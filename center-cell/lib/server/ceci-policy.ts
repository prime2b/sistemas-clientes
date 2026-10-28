export const CECI_SESSION_IDLE_MS=24*60*60*1000;
export function shouldRestartWithCeci(conversation:{status:string;assigned:string;claimed_at?:number},enabled:boolean,hasText:boolean,agentHasReplied:boolean,sharedInbox=false,activity?:{lastInteraction:number;now:number}){
  if(!enabled||!hasText)return false;
  if(conversation.status==='closed')return true;
  // A handoff owns the current session, not every future visit by this number.
  // A recent human claim also keeps ownership even if the last message is old.
  if(sharedInbox)return conversation.status==='human'&&!!activity?.lastInteraction&&activity.now-Math.max(activity.lastInteraction,Number(conversation.claimed_at||0))>=CECI_SESSION_IDLE_MS;
  return conversation.status==='human'&&!conversation.assigned&&!agentHasReplied;
}

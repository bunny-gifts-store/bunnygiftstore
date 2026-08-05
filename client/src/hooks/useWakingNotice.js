import { useEffect, useState } from 'react';

// Escalating reassurance while a sign-in request is in flight.
//
// The API host spins down when idle, so a login can legitimately take most of a
// minute while the server boots. A button that just says "Signing in…" for 60
// seconds is indistinguishable from a broken one — people give up, or hammer it.
// Naming what is happening, and roughly how long it lasts, turns a wait that
// looks like a bug into one that looks like a wait.
const STAGES = [
  { after: 4000, message: 'Waking up the store server…' },
  { after: 12000, message: 'The server sleeps when the store is quiet — this can take up to a minute.' },
  { after: 35000, message: 'Almost there, thanks for your patience…' },
];

/**
 * @param {boolean} busy  whether a request is currently in flight
 * @returns {string}      the message to show, or '' when there is nothing to say
 */
export default function useWakingNotice(busy) {
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!busy) {
      setMessage('');
      return undefined;
    }
    const timers = STAGES.map((stage) => setTimeout(() => setMessage(stage.message), stage.after));
    return () => timers.forEach(clearTimeout);
  }, [busy]);

  return message;
}

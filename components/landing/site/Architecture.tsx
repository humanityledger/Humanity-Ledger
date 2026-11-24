'use client';

/**
 * Moment 4: the architecture, from the device to Ethereum, in two states the reader toggles.
 *
 *  - Today: the device in the centre; messages to XMTP; calls peer to peer, through TURN when a
 *    direct path is blocked; payments to Aztec, which settles on Ethereum; our server as a dashed
 *    box holding sessions, contacts, communities, Status and push.
 *  - With Ledger Relay (in design): the dashed box splits into data moved onto the device and
 *    relays that anyone can run; the goal sentence shows only here, marked as the goal.
 *
 * Hover or tap a box, or use the buttons under the diagram (the keyboard path), to read one
 * sentence about it and what it can see. Hand-built SVG; motion is opacity and transform only.
 */
import React from 'react';
import s from './site.module.css';
import { useT } from '@/lib/i18n/client';

type NodeId = 'device' | 'xmtp' | 'peer' | 'turn' | 'aztec' | 'ethereum' | 'server' | 'onDevice' | 'relays';
type Node = { name: string; text: string; sees: string };
type State = 'today' | 'relay';

const TODAY: NodeId[] = ['device', 'xmtp', 'peer', 'turn', 'aztec', 'ethereum', 'server'];
const RELAY: NodeId[] = ['device', 'xmtp', 'peer', 'relays', 'aztec', 'ethereum', 'onDevice'];

function Box({
  id, x, y, w, h, sub, kind, active, onPick, name,
}: {
  id: NodeId; x: number; y: number; w: number; h: number; sub: string[]; name: string;
  kind?: 'device' | 'server' | 'relay'; active: NodeId; onPick: (id: NodeId) => void;
}) {
  const cls = [s.node, kind === 'device' ? s.nodeDevice : '', kind === 'server' ? s.nodeServer : '', kind === 'relay' ? s.nodeRelay : ''].join(' ');
  return (
    <g className={cls} data-active={active === id} onMouseEnter={() => onPick(id)} onClick={() => onPick(id)}>
      <rect className={s.nodeBox} x={x} y={y} width={w} height={h} rx="10" />
      <text className={s.nodeName} x={x + 16} y={y + 28}>{name}</text>
      {sub.map((line, i) => (
        <text key={i} className={s.nodeSub} x={x + 16} y={y + 48 + i * 17}>{line}</text>
      ))}
    </g>
  );
}

const goalText = (g: string) => {
  const t = g.replace(/^The goal: /, '');
  return t.charAt(0).toUpperCase() + t.slice(1);
};

export function Architecture({
  nodes, states, goal,
}: {
  nodes: Record<NodeId, Node>;
  states: { today: string; relay: string };
  goal: string;
}) {
  const tr = useT();
  const [state, setState] = React.useState<State>('today');
  const [active, setActive] = React.useState<NodeId>('device');
  const visible = state === 'today' ? TODAY : RELAY;
  const current = visible.includes(active) ? active : 'device';
  const node = nodes[current];

  const switchTo = (next: State) => {
    setState(next);
    if (next === 'relay' && (active === 'server' || active === 'turn')) setActive(active === 'server' ? 'onDevice' : 'relays');
    if (next === 'today' && (active === 'onDevice' || active === 'relays')) setActive(active === 'onDevice' ? 'server' : 'turn');
  };

  const summary =
    state === 'today'
      ? 'Diagram, today: your device sends MLS ciphertext to the XMTP network, calls the other device directly or through a TURN relay, and sends proofs to Aztec Network, which settles on Ethereum. Our server holds sign-in sessions, contacts, communities, Status and push.'
      : 'Diagram, with Ledger Relay, in design: contacts, communities and Status move to your devices as MLS messages, and calls, encrypted files and notifications go through relays anyone can run. Messages and payments are unchanged.';

  return (
    <div className={s.arch} data-state={state}>
      <div className={s.archBar}>
        <div className={s.toggle} role="group" aria-label={tr("Architecture state")}>
          <button type="button" className={s.toggleBtn} aria-pressed={state === 'today'} onClick={() => switchTo('today')}>{states.today}</button>
          <button type="button" className={s.toggleBtn} aria-pressed={state === 'relay'} onClick={() => switchTo('relay')}>{states.relay}</button>
        </div>
        <p className={s.goal} aria-hidden={state !== 'relay'}><b>{tr("Goal.")}</b> {tr(goalText(goal))}</p>
      </div>

      <div className={s.archCanvas}>
        <svg className={s.archSvg} viewBox="0 0 960 460" role="img" aria-label={summary}>
          {/* Edges shared by both states */}
          <path className={`${s.edge} ${s.edgeStrong}`} d="M500 192 C552 192 548 67 600 67" />
          <text className={s.edgeLabel} x="546" y="104" textAnchor="end">MLS ciphertext</text>
          <path className={s.edge} d="M780 67 C846 67 878 118 878 204" />
          <path className={`${s.edge} ${s.edgeDash}`} d="M500 236 L600 236" />
          <path className={`${s.edge} ${s.edgeDash}`} d="M780 236 L816 236" />
          <text className={s.edgeLabel} x="508" y="227">when blocked</text>
          <path className={`${s.edge} ${s.edgeStrong}`} d="M500 282 C612 338 792 338 878 268" />
          <text className={s.edgeLabel} x="689" y="350" textAnchor="middle">direct, DTLS-SRTP</text>
          <path className={`${s.edge} ${s.edgeStrong}`} d="M500 300 C556 300 548 403 600 403" />
          <text className={s.edgeLabel} x="534" y="362">proof</text>
          <path className={s.edge} d="M780 403 L846 403" />
          <text className={s.edgeLabel} x="813" y="394" textAnchor="middle">settles</text>

          {/* Nodes shared by both states */}
          <Box id="device" kind="device" x={290} y={160} w={210} h={150} name={nodes.device.name} sub={['App, keys, prover', 'Decrypts and proves here']} active={current} onPick={setActive} />
          <Box id="xmtp" x={600} y={36} w={180} h={62} name={nodes.xmtp.name} sub={['Relays ciphertext']} active={current} onPick={setActive} />
          <Box id="peer" x={816} y={204} w={124} h={64} name={nodes.peer.name} sub={['Participant']} active={current} onPick={setActive} />
          <Box id="aztec" x={600} y={372} w={180} h={62} name={nodes.aztec.name} sub={['Proofs and notes']} active={current} onPick={setActive} />
          <Box id="ethereum" x={846} y={372} w={94} h={62} name={nodes.ethereum.name} sub={['Settlement']} active={current} onPick={setActive} />

          {/* Today */}
          <g className={s.gToday}>
            <path className={`${s.edge} ${s.edgeDash}`} d="M204 236 L290 236" />
            <Box id="server" kind="server" x={20} y={170} w={184} h={132} name={nodes.server.name} sub={['Sessions', 'Contacts', 'Communities, Status', 'Push']} active={current} onPick={setActive} />
            <Box id="turn" x={600} y={204} w={180} h={64} name={nodes.turn.name} sub={['Encrypted stream']} active={current} onPick={setActive} />
          </g>

          {/* With Ledger Relay, in design */}
          <g className={s.gRelay}>
            <Box id="onDevice" kind="device" x={290} y={330} w={210} h={92} name={nodes.onDevice.name} sub={['Contacts, communities,', 'Status, as MLS messages']} active={current} onPick={setActive} />
            <Box id="relays" kind="relay" x={600} y={190} w={180} h={92} name={nodes.relays.name} sub={['Calls, files,', 'notifications']} active={current} onPick={setActive} />
          </g>
        </svg>
      </div>

      <div className={s.archFoot}>
        <div className={s.legend} role="group" aria-label={tr("Parts of the diagram")}>
          {(['device', 'xmtp', 'peer', 'turn', 'relays', 'aztec', 'ethereum', 'server', 'onDevice'] as NodeId[]).map((id) => (
            <button
              key={id}
              type="button"
              className={s.legendBtn}
              hidden={!visible.includes(id)}
              aria-pressed={current === id}
              onClick={() => setActive(id)}
            >
              {nodes[id].name}
            </button>
          ))}
        </div>
        <div className={s.detail} aria-live="polite">
          <h3>{node.name}</h3>
          <p>{tr(node.text)}</p>
          <dl>
            <dt>{tr("Can see")}</dt>
            <dd>{node.sees}</dd>
          </dl>
        </div>
      </div>
    </div>
  );
}

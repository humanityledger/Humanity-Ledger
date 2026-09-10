import Peer, { MediaConnection } from 'peerjs';

export type CallState = 'idle' | 'calling' | 'ringing' | 'connecting' | 'active';

export interface Participant {
  address: string;
  peerId: string;
  stream: MediaStream | null;
  call: MediaConnection | null;
  isMuted: boolean;
  isCameraOff: boolean;
}

export class WebRTCEngine {
  private peer: Peer | null = null;
  private myAddress: string;
  private localStream: MediaStream | null = null;
  private activeCalls: Map<string, MediaConnection> = new Map();
  private participants: Map<string, Participant> = new Map();

  constructor(address: string) {
    this.myAddress = address;
  }

  private derivePeerId(walletAddress: string): string {
    return 'ledger' + walletAddress.slice(2, 12).toLowerCase();
  }

  private emit(event: string, detail: unknown) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(event, { detail }));
    }
  }

  public initialize() {
    const peerId = this.derivePeerId(this.myAddress);
    this.peer = new Peer(peerId, {
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' },
        ],
      },
    });

    this.peer.on('call', (call) => {
      const incomingAddress = this.peerIdToAddress(call.peer);
      if (this.localStream && this.activeCalls.size > 0) {
        call.answer(this.localStream);
        this._trackCall(call, incomingAddress);
        this.activeCalls.set(incomingAddress, call);
      } else {
        this.emit('webrtc_incoming_call', { call, fromAddress: incomingAddress });
      }
    });

    this.peer.on('error', (err) => {
      console.error('[WebRTCEngine] Error:', err);
      this.emit('webrtc_error', { error: err.type });
    });

    this.peer.on('disconnected', () => {
      this.peer?.reconnect();
    });
  }

  private peerIdToAddress(peerId: string): string {
    for (const [addr] of this.participants) {
      if (this.derivePeerId(addr) === peerId) return addr;
    }
    return peerId;
  }

  public async getLocalStream(isVideo: boolean): Promise<MediaStream> {
    if (this.localStream) return this.localStream;
    this.localStream = await navigator.mediaDevices.getUserMedia({
      video: isVideo ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    return this.localStream;
  }

  public async callParticipant(targetAddress: string, isVideo: boolean): Promise<MediaConnection> {
    if (!this.peer) throw new Error('Peer not initialized');
    if (this.activeCalls.has(targetAddress)) return this.activeCalls.get(targetAddress)!;

    const localStream = await this.getLocalStream(isVideo);
    const targetPeerId = this.derivePeerId(targetAddress);

    this.participants.set(targetAddress, {
      address: targetAddress, peerId: targetPeerId, stream: null, call: null,
      isMuted: false, isCameraOff: false,
    });

    const call = this.peer.call(targetPeerId, localStream, {
      metadata: { callerAddress: this.myAddress, isVideo, isGroup: this.activeCalls.size > 0 },
    });

    this._trackCall(call, targetAddress);
    this.activeCalls.set(targetAddress, call);
    this.emit('webrtc_participant_connecting', { address: targetAddress });
    return call;
  }

  public async startGroupCall(participants: string[], isVideo: boolean): Promise<void> {
    await this.getLocalStream(isVideo);
    await Promise.allSettled(participants.map((addr) => this.callParticipant(addr, isVideo)));
    this.emit('webrtc_group_call_started', { participants, isVideo });
  }

  public async answerCall(call: MediaConnection, isVideo: boolean): Promise<void> {
    const localStream = await this.getLocalStream(isVideo);
    const incomingAddress = this.peerIdToAddress(call.peer);
    call.answer(localStream);
    this._trackCall(call, incomingAddress);
    this.activeCalls.set(incomingAddress, call);
  }

  private _trackCall(call: MediaConnection, address: string) {
    call.on('stream', (remoteStream) => {
      const p = this.participants.get(address);
      if (p) {
        p.stream = remoteStream;
        p.call = call;
      } else {
        this.participants.set(address, {
          address, peerId: call.peer, stream: remoteStream, call,
          isMuted: false, isCameraOff: false,
        });
      }
      this.emit('webrtc_participant_stream', { address, stream: remoteStream });
      this.emit('webrtc_participants_updated', { participants: this.getParticipants() });
    });

    call.on('close', () => {
      this.activeCalls.delete(address);
      this.participants.delete(address);
      this.emit('webrtc_participant_left', { address });
      this.emit('webrtc_participants_updated', { participants: this.getParticipants() });
      if (this.activeCalls.size === 0) {
        this._cleanupLocalStream();
        this.emit('webrtc_call_ended', {});
      }
    });

    call.on('error', (err) => {
      console.error('[WebRTCEngine] Call error with', address, err);
    });
  }

  public removeParticipant(address: string): void {
    const call = this.activeCalls.get(address);
    if (call) { call.close(); }
  }

  public endCall(): void {
    for (const [, call] of this.activeCalls) {
      try { call.close(); } catch { /* ignore */ }
    }
    this.activeCalls.clear();
    this.participants.clear();
    this._cleanupLocalStream();
    this.emit('webrtc_call_ended', {});
  }

  public toggleMute(): boolean {
    if (!this.localStream) return false;
    const tracks = this.localStream.getAudioTracks();
    const nowMuted = tracks[0]?.enabled === true;
    tracks.forEach((t) => { t.enabled = !nowMuted; });
    this.emit('webrtc_local_mute_changed', { muted: nowMuted });
    return nowMuted;
  }

  public toggleCamera(): boolean {
    if (!this.localStream) return false;
    const tracks = this.localStream.getVideoTracks();
    const nowOff = tracks[0]?.enabled === true;
    tracks.forEach((t) => { t.enabled = !nowOff; });
    this.emit('webrtc_local_camera_changed', { cameraOff: nowOff });
    return nowOff;
  }

  public getLocalStreamRef(): MediaStream | null { return this.localStream; }
  public getParticipants(): Participant[] { return Array.from(this.participants.values()); }
  public isInCall(): boolean { return this.activeCalls.size > 0; }

  /** Screen share: replace video track in all active peer connections */
  public async startScreenShare(): Promise<boolean> {
    try {
      const screenStream = await (navigator.mediaDevices as any).getDisplayMedia({ video: true, audio: false });
      const screenTrack = screenStream.getVideoTracks()[0];
      if (!screenTrack) return false;

      // Replace camera track with screen track in every active call's sender
      if (this.localStream) {
        const camTrack = this.localStream.getVideoTracks()[0];
        if (camTrack) this.localStream.removeTrack(camTrack);
        this.localStream.addTrack(screenTrack);
      }

      // Replace sender tracks in all peer connections
      for (const [, call] of this.activeCalls) {
        const pc: RTCPeerConnection | undefined = (call as any).peerConnection;
        if (pc) {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          if (sender) await sender.replaceTrack(screenTrack).catch(() => {});
        }
      }

      // When screen share ends (user clicks browser "Stop"), auto-revert
      screenTrack.addEventListener('ended', () => { this.stopScreenShare(); }, { once: true });
      this.emit('webrtc_screen_share_started', {});
      return true;
    } catch {
      return false;
    }
  }

  /** Stop screen share — revert to camera */
  public stopScreenShare(): void {
    if (!this.localStream) return;
    const screenTrack = this.localStream.getVideoTracks()[0];
    if (screenTrack) {
      screenTrack.stop();
      this.localStream.removeTrack(screenTrack);
    }

    // Re-add camera track
    navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } } })
      .then(camStream => {
        const camTrack = camStream.getVideoTracks()[0];
        if (!camTrack) return;
        this.localStream?.addTrack(camTrack);
        for (const [, call] of this.activeCalls) {
          const pc: RTCPeerConnection | undefined = (call as any).peerConnection;
          if (pc) {
            const sender = pc.getSenders().find(s => s.track?.kind === 'video');
            if (sender) sender.replaceTrack(camTrack).catch(() => {});
          }
        }
        this.emit('webrtc_screen_share_stopped', {});
      })
      .catch(() => { this.emit('webrtc_screen_share_stopped', {}); });
  }

  public destroy(): void {
    this.endCall();
    if (this.peer) { this.peer.destroy(); this.peer = null; }
  }

  private _cleanupLocalStream(): void {
    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }
  }
}


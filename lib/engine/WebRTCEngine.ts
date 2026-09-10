import Peer, { MediaConnection } from 'peerjs';

export type CallState = 'idle' | 'calling' | 'ringing' | 'connecting' | 'active';

export interface Participant {
  address: string;
  peerId: string;
  stream: MediaStream | null;
  call: MediaConnection | null;
  isMuted: boolean;
  isCameraOff: boolean;
  networkRtt?: number;      // ms round-trip time from getStats()
  networkPacketLoss?: number; // packet loss count
}

export class WebRTCEngine {
  private peer: Peer | null = null;
  private myAddress: string;
  private localStream: MediaStream | null = null;
  private activeCalls: Map<string, MediaConnection> = new Map();
  private participants: Map<string, Participant> = new Map();
  private telemetryInterval: NodeJS.Timeout | null = null;

  constructor(address: string) {
    this.myAddress = address;
  }

  private startTelemetry() {
    if (this.telemetryInterval) clearInterval(this.telemetryInterval);
    this.telemetryInterval = setInterval(async () => {
      for (const [address, call] of this.activeCalls.entries()) {
        const pc = (call as any).peerConnection as RTCPeerConnection | undefined;
        if (!pc) continue;
        try {
          const stats = await pc.getStats();
          let rtt = 0, packetLoss = 0, jitter = 0;
          stats.forEach(report => {
            if (report.type === 'candidate-pair' && report.state === 'succeeded') {
              rtt = report.currentRoundTripTime || report.roundTripTime || 0;
            }
            if (report.type === 'inbound-rtp' && report.kind === 'video') {
              packetLoss = report.packetsLost || 0;
              jitter = report.jitter || 0;
            }
          });
          if (rtt > 0 || packetLoss > 0) {
            this.emit('webrtc_telemetry', { address, rtt: rtt * 1000, packetLoss, jitter: jitter * 1000 });
          }
        } catch (e) { /* ignore stats errors */ }
      }
    }, 5000);
  }

  private stopTelemetry() {
    if (this.telemetryInterval) {
      clearInterval(this.telemetryInterval);
      this.telemetryInterval = null;
    }
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
    this.startTelemetry();
    const peerId = this.derivePeerId(this.myAddress);
    this.peer = new Peer(peerId, {
      // Use PeerJS cloud signaling — reliable and free for signaling only
      // (Media goes P2P directly, signaling traffic is minimal)
      config: {
        iceServers: [
          // Google STUN — most reliable globally
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          // Twilio STUN — good Asian/LatAm coverage
          { urls: 'stun:global.stun.twilio.com:3478' },
          // Cloudflare STUN
          { urls: 'stun:stun.cloudflare.com:3478' },
          // Public TURN relays as fallback for symmetric NAT, hotel WiFi, CGNAT
          // These handle UDP-blocked networks (airports, corporate firewalls)
          {
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'openrelayproject',
          },
          {
            urls: 'turn:openrelay.metered.ca:443',
            username: 'openrelayproject',
            credential: 'openrelayproject',
          },
          {
            urls: 'turn:openrelay.metered.ca:443?transport=tcp',
            username: 'openrelayproject',
            credential: 'openrelayproject',
          },
        ],
        iceTransportPolicy: 'all', // Try direct first, fall back to TURN
        iceCandidatePoolSize: 10,  // Gather more candidates upfront
      },
    });

    this.peer.on('call', (call) => {
      const incomingAddress = this.peerIdToAddress(call.peer);
      if (this.localStream && this.activeCalls.size > 0) {
        // Already in a group call — auto-answer new participants
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
      // Auto-reconnect on network errors (not on fatal "unavailable-id")
      if (err.type !== 'unavailable-id' && err.type !== 'invalid-id') {
        setTimeout(() => { this.peer?.reconnect(); }, 2000);
      }
    });

    this.peer.on('disconnected', () => {
      console.warn('[WebRTCEngine] Disconnected from signaling server — reconnecting');
      setTimeout(() => { this.peer?.reconnect(); }, 1000);
    });
  }


  private peerIdToAddress(peerId: string): string {
    for (const [addr] of this.participants) {
      if (this.derivePeerId(addr) === peerId) return addr;
    }
    return peerId;
  }

  public setLocalStream(stream: MediaStream) {
    this.localStream = stream;
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
    this.stopTelemetry();
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


// Web Audio API Synthesizer for Lumina Jump
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private chargeOsc: OscillatorNode | null = null;
  private chargeGain: GainNode | null = null;
  private padOsc1: OscillatorNode | null = null;
  private padOsc2: OscillatorNode | null = null;
  private padGain: GainNode | null = null;
  private isMuted: boolean = false;
  private isUnlocked: boolean = false;

  constructor() {
    // Loaded status
    const storedMute = localStorage.getItem('lumina-muted');
    this.isMuted = storedMute === 'true';
  }

  init() {
    if (this.isUnlocked) return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioContextClass();
      this.isUnlocked = true;
      console.log('Audio Context Initialized and Unlocked.');
      
      // Start ambient background pad
      this.startBackgroundPad();
    } catch (e) {
      console.warn('Web Audio API not supported in this browser', e);
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Looping background atmospheric sound
  startBackgroundPad() {
    if (!this.ctx || this.isMuted) return;
    
    try {
      this.stopBackgroundPad();

      this.padGain = this.ctx.createGain();
      this.padGain.gain.setValueAtTime(0.06, this.ctx.currentTime); // low volume background

      // Low frequency detuned saw/triangle wave for synth pad
      this.padOsc1 = this.ctx.createOscillator();
      this.padOsc2 = this.ctx.createOscillator();
      
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(260, this.ctx.currentTime); // Warm low-pass filter
      filter.Q.setValueAtTime(1, this.ctx.currentTime);

      this.padOsc1.type = 'triangle';
      this.padOsc1.frequency.setValueAtTime(110, this.ctx.currentTime); // A2

      this.padOsc2.type = 'sawtooth';
      this.padOsc2.frequency.setValueAtTime(110.5, this.ctx.currentTime); // detuned slightly

      this.padOsc1.connect(filter);
      this.padOsc2.connect(filter);
      filter.connect(this.padGain);
      this.padGain.connect(this.ctx.destination);

      this.padOsc1.start(0);
      this.padOsc2.start(0);
    } catch (e) {
      console.error('Failed to start ambient pad:', e);
    }
  }

  stopBackgroundPad() {
    if (this.padOsc1) {
      try { this.padOsc1.stop(); } catch(e){}
      this.padOsc1 = null;
    }
    if (this.padOsc2) {
      try { this.padOsc2.stop(); } catch(e){}
      this.padOsc2 = null;
    }
    if (this.padGain) {
      try { this.padGain.disconnect(); } catch(e){}
      this.padGain = null;
    }
  }

  // Start the charging sound (oscillating frequency based on player holding space)
  startCharge() {
    this.resume();
    if (!this.ctx || this.isMuted) return;

    try {
      this.stopCharge(); // Clean up if any exists

      this.chargeOsc = this.ctx.createOscillator();
      this.chargeGain = this.ctx.createGain();

      this.chargeOsc.type = 'sine';
      this.chargeOsc.frequency.setValueAtTime(220, this.ctx.currentTime); // Start frequency (A3)
      this.chargeGain.gain.setValueAtTime(0.01, this.ctx.currentTime); // soft start
      this.chargeGain.gain.exponentialRampToValueAtTime(0.15, this.ctx.currentTime + 0.1);

      // Low pass filter to make charge feel warm and power-like
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, this.ctx.currentTime);

      this.chargeOsc.connect(filter);
      filter.connect(this.chargeGain);
      this.chargeGain.connect(this.ctx.destination);

      this.chargeOsc.start(0);
    } catch (e) {
      console.error('Failed to start charge sound:', e);
    }
  }

  // Update frequency of charge oscillator based on current charge percent (0.0 to 1.0)
  updateCharge(percent: number) {
    if (!this.ctx || !this.chargeOsc || !this.chargeGain || this.isMuted) return;
    
    // Frequency swings between 220Hz (A3) and 660Hz (E5)
    const freq = 220 + percent * 440;
    this.chargeOsc.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.05);
    
    // Gain increases slightly as charge increases
    const vol = 0.05 + percent * 0.15;
    this.chargeGain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.05);
  }

  stopCharge() {
    if (this.chargeOsc && this.ctx && this.chargeGain) {
      try {
        const osc = this.chargeOsc;
        const gain = this.chargeGain;
        const now = this.ctx.currentTime;
        gain.gain.setValueAtTime(gain.gain.value, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        osc.stop(now + 0.05);
      } catch (e) {}
      this.chargeOsc = null;
      this.chargeGain = null;
    }
  }

  // Triggered when jumping
  playJump(percent: number) {
    this.resume();
    this.stopCharge();
    if (!this.ctx || this.isMuted) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      
      // Starting frequency matches jump energy
      const startFreq = 300 + percent * 300;
      const endFreq = startFreq + 400;

      osc.frequency.setValueAtTime(startFreq, now);
      osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.15);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.25);

      // Add a quick white noise burst for "whoosh" air drag
      this.playWhoosh(now, percent);
    } catch (e) {
      console.error(e);
    }
  }

  // Synthesize a white noise puff
  playWhoosh(startTime: number, percent: number) {
    if (!this.ctx) return;
    try {
      const bufferSize = this.ctx.sampleRate * 0.15; // 0.15 seconds
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noiseNode = this.ctx.createBufferSource();
      noiseNode.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1000, startTime);
      filter.frequency.exponentialRampToValueAtTime(3000, startTime + 0.12);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.03 * (0.5 + percent * 0.5), startTime);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.15);

      noiseNode.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.ctx.destination);

      noiseNode.start(startTime);
      noiseNode.stop(startTime + 0.15);
    } catch (e) {}
  }

  // Triggered when landing safely
  playLand() {
    this.resume();
    if (!this.ctx || this.isMuted) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      // Deep synth kick/thump
      osc.type = 'sine';
      osc.frequency.setValueAtTime(120, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.12);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(150, now);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.15);
    } catch (e) {}
  }

  // Triggered when hitting bouncy spring platforms
  playBouncy() {
    this.resume();
    if (!this.ctx || this.isMuted) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.exponentialRampToValueAtTime(600, now + 0.08);
      osc.frequency.exponentialRampToValueAtTime(250, now + 0.25);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.25);
    } catch (e) {}
  }

  // Sound for scoring milestone
  playScore() {
    this.resume();
    if (!this.ctx || this.isMuted) return;

    try {
      const now = this.ctx.currentTime;
      
      // Play a lovely retro chime: C5 (523Hz) -> G5 (784Hz) -> C6 (1046Hz)
      const notes = [523.25, 783.99, 1046.50];
      notes.forEach((freq, index) => {
        if (!this.ctx) return;
        const timeOffset = index * 0.06;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + timeOffset);

        gain.gain.setValueAtTime(0.1, now + timeOffset);
        gain.gain.exponentialRampToValueAtTime(0.001, now + timeOffset + 0.2);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now + timeOffset);
        osc.stop(now + timeOffset + 0.2);
      });
    } catch (e) {}
  }

  // Play Crystal collect sound
  playCrystal() {
    this.resume();
    if (!this.ctx || this.isMuted) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(987.77, now); // B5
      osc.frequency.setValueAtTime(1318.51, now + 0.08); // E6

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.2);
    } catch (e) {}
  }

  // Play active skill activation sound
  playSkill() {
    this.resume();
    if (!this.ctx || this.isMuted) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(800, now + 0.4);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(400, now);
      filter.frequency.exponentialRampToValueAtTime(2000, now + 0.4);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.4);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.4);
    } catch (e) {}
  }

  // Triggered when falling off screen
  playGameOver() {
    this.resume();
    this.stopCharge();
    if (!this.ctx || this.isMuted) return;

    try {
      const now = this.ctx.currentTime;
      
      // Descending sad minor sweep
      const notes = [329.63, 293.66, 261.63, 220.00]; // E4, D4, C4, A3
      notes.forEach((freq, index) => {
        if (!this.ctx) return;
        const timeOffset = index * 0.12;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now + timeOffset);
        osc.frequency.exponentialRampToValueAtTime(freq - 50, now + timeOffset + 0.25);

        // Filter to make it sound warm/muffled
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(400, now + timeOffset);

        gain.gain.setValueAtTime(0.12, now + timeOffset);
        gain.gain.linearRampToValueAtTime(0.001, now + timeOffset + 0.3);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now + timeOffset);
        osc.stop(now + timeOffset + 0.3);
      });
    } catch (e) {}
  }

  toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    localStorage.setItem('lumina-muted', String(this.isMuted));
    if (this.isMuted) {
      this.stopBackgroundPad();
      this.stopCharge();
    } else {
      this.startBackgroundPad();
    }
    return this.isMuted;
  }

  getMuted(): boolean {
    return this.isMuted;
  }
}

export const audio = new AudioEngine();

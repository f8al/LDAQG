"""Generate an original, intentionally amateurish final-round thinking cue."""

from __future__ import annotations

import math
import random
import struct
import wave
from pathlib import Path


SAMPLE_RATE = 44_100
DURATION = 30.5
random.seed(8675309)

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "assets" / "audio" / "two-kids-final-round.wav"


def midi(note: int) -> float:
    return 440.0 * 2 ** ((note - 69) / 12)


def envelope(t: float, duration: float, attack: float = 0.035, release: float = 0.08) -> float:
    return min(1.0, t / attack, max(0.0, (duration - t) / release))


def recorder(freq: float, t: float, duration: float, phase: float) -> float:
    # Mostly pure with a little upper harmonic and far too much breath.
    wobble = 1 + 0.005 * math.sin(2 * math.pi * 5.4 * t)
    tone = (
        math.sin(phase * wobble)
        + 0.20 * math.sin(2 * phase * wobble)
        + 0.07 * math.sin(3 * phase * wobble)
    )
    breath = random.uniform(-1, 1) * (0.10 + 0.05 * math.sin(2 * math.pi * 2.1 * t))
    return envelope(t, duration) * (0.62 * tone + breath)


def kazoo(freq: float, t: float, duration: float, phase: float) -> float:
    # A buzzy membrane-like waveform with a nasal resonance.
    vibrato = 1 + 0.014 * math.sin(2 * math.pi * 6.2 * t + 0.7)
    p = phase * vibrato
    buzz = sum(math.sin(h * p) / h for h in range(1, 10, 2))
    nasal = 0.28 * math.sin(3 * p) + 0.16 * math.sin(5 * p)
    return envelope(t, duration, 0.018, 0.055) * (0.52 * buzz + nasal)


def add_note(track: list[float], start: float, duration: float, note: int, instrument: str,
             volume: float = 0.24, detune_cents: float = 0.0) -> None:
    start_index = max(0, int(start * SAMPLE_RATE))
    end_index = min(len(track), int((start + duration) * SAMPLE_RATE))
    frequency = midi(note) * 2 ** (detune_cents / 1200)
    phase = 0.0
    phase_step = 2 * math.pi * frequency / SAMPLE_RATE
    voice = recorder if instrument == "recorder" else kazoo
    for index in range(start_index, end_index):
        local_t = (index - start_index) / SAMPLE_RATE
        phase += phase_step
        track[index] += volume * voice(frequency, local_t, duration, phase)


def add_tap(track: list[float], start: float, loud: bool = False) -> None:
    start_index = int(start * SAMPLE_RATE)
    length = int(0.055 * SAMPLE_RATE)
    for offset in range(length):
        if start_index + offset >= len(track):
            break
        t = offset / SAMPLE_RATE
        decay = math.exp(-65 * t)
        noise = random.uniform(-1, 1)
        track[start_index + offset] += (0.13 if loud else 0.055) * decay * noise


def main() -> None:
    samples = [0.0] * int(DURATION * SAMPLE_RATE)
    beat = 0.5  # 120 BPM, fifteen original four-beat bars plus a button ending.

    # Original melody: deliberately simple, repetitive, and unrelated to any TV theme.
    recorder_bars = [
        [67, 71, 69, 64], [67, 72, 71, 67], [69, 67, 64, 62], [64, 66, 67, 0],
        [71, 69, 67, 64], [72, 71, 67, 69], [74, 71, 69, 66], [67, 0, 67, 0],
        [64, 67, 71, 69], [66, 69, 72, 71], [67, 71, 74, 72], [69, 67, 66, 62],
        [64, 69, 67, 71], [72, 69, 66, 67], [74, 72, 71, 67],
    ]
    kazoo_bars = [
        [55, 0, 55, 0], [53, 0, 55, 0], [50, 0, 52, 0], [48, 0, 55, 0],
        [52, 55, 0, 55], [53, 0, 55, 52], [50, 54, 0, 50], [55, 0, 0, 55],
        [48, 0, 52, 0], [50, 0, 53, 0], [52, 0, 55, 0], [50, 0, 54, 0],
        [48, 52, 0, 55], [53, 0, 50, 55], [55, 0, 55, 0],
    ]

    for bar_index, (high_bar, low_bar) in enumerate(zip(recorder_bars, kazoo_bars)):
        for beat_index in range(4):
            nominal = (bar_index * 4 + beat_index) * beat
            add_tap(samples, nominal, loud=bar_index >= 13)

            high_note = high_bar[beat_index]
            if high_note:
                # Kid one rushes, drifts sharp, and squeaks one note in bar 11.
                timing = random.uniform(-0.045, 0.025)
                detune = random.uniform(7, 24)
                if bar_index == 10 and beat_index == 2:
                    high_note += 1
                    detune += 35
                add_note(samples, nominal + timing, beat * 0.82, high_note, "recorder", 0.23, detune)

            low_note = low_bar[beat_index]
            if low_note:
                # Kid two is late, flat, and occasionally holds the kazoo too long.
                timing = random.uniform(0.025, 0.085)
                detune = random.uniform(-31, -10)
                duration = beat * random.uniform(0.78, 1.20)
                add_note(samples, nominal + timing, duration, low_note, "kazoo", 0.22, detune)

    # A ragged unison finish followed by one proud, unnecessary kazoo honk.
    add_note(samples, 29.25, 0.65, 67, "recorder", 0.28, 18)
    add_note(samples, 29.32, 0.72, 55, "kazoo", 0.27, -22)
    add_tap(samples, 29.28, loud=True)
    add_note(samples, 30.05, 0.28, 62, "kazoo", 0.20, -45)

    peak = max(abs(sample) for sample in samples) or 1
    gain = 0.88 / peak
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(OUTPUT), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(SAMPLE_RATE)
        frames = bytearray()
        for sample in samples:
            value = max(-1.0, min(1.0, sample * gain))
            frames.extend(struct.pack("<h", int(value * 32767)))
        wav.writeframes(frames)
    print(OUTPUT)


if __name__ == "__main__":
    main()

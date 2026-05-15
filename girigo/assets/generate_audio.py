import wave
import struct
import math

def generate_tone(filename, frequency, duration, volume=0.5, type='sine'):
    sample_rate = 44100
    num_samples = int(sample_rate * duration)
    
    with wave.open(filename, 'w') as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        
        for i in range(num_samples):
            t = float(i) / sample_rate
            if type == 'sine':
                value = math.sin(2.0 * math.pi * frequency * t)
            elif type == 'tick':
                # Quick burst of noise or short frequency
                if t < 0.05:
                    value = math.sin(2.0 * math.pi * 1000 * t) * (1.0 - t/0.05)
                else:
                    value = 0
            
            # Apply fade out for chime
            if type == 'chime':
                fade = max(0, 1.0 - (t / duration))
                value = math.sin(2.0 * math.pi * frequency * t) * fade
                # Add some harmonics
                value += 0.5 * math.sin(2.0 * math.pi * frequency * 2 * t) * fade
                value /= 1.5
                
            packed_value = struct.pack('h', int(value * volume * 32767.0))
            wav_file.writeframes(packed_value)

# Generate tick (short, sharp)
generate_tone('tick.wav', 1000, 0.1, volume=0.5, type='tick')

# Generate chime (longer, atmospheric)
generate_tone('chime.wav', 440, 3.0, volume=0.7, type='chime')

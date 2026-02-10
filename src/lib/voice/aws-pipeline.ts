import {
  TranscribeStreamingClient,
  StartStreamTranscriptionCommand,
  LanguageCode,
  MediaEncoding,
} from "@aws-sdk/client-transcribe-streaming";
import {
  PollyClient,
  SynthesizeSpeechCommand,
  Engine,
  OutputFormat,
  VoiceId,
} from "@aws-sdk/client-polly";

const transcribeClient = new TranscribeStreamingClient({
  region: process.env.AWS_REGION || "ap-northeast-1",
  ...(process.env.AWS_ACCESS_KEY_ID && {
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    },
  }),
});

const pollyClient = new PollyClient({
  region: process.env.AWS_REGION || "ap-northeast-1",
  ...(process.env.AWS_ACCESS_KEY_ID && {
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    },
  }),
});

/**
 * Start Amazon Transcribe streaming session
 */
export async function startTranscribeStream(
  audioStream: AsyncIterable<Uint8Array>,
  onTranscription: (text: string, isFinal: boolean) => void
): Promise<void> {
  async function* audioGenerator() {
    for await (const chunk of audioStream) {
      yield { AudioEvent: { AudioChunk: chunk } };
    }
  }

  const command = new StartStreamTranscriptionCommand({
    LanguageCode: LanguageCode.JA_JP,
    MediaEncoding: MediaEncoding.PCM,
    MediaSampleRateHertz: 16000,
    AudioStream: audioGenerator(),
  });

  const response = await transcribeClient.send(command);

  if (response.TranscriptResultStream) {
    for await (const event of response.TranscriptResultStream) {
      if (event.TranscriptEvent?.Transcript?.Results) {
        for (const result of event.TranscriptEvent.Transcript.Results) {
          if (result.Alternatives?.[0]?.Transcript) {
            onTranscription(
              result.Alternatives[0].Transcript,
              !result.IsPartial
            );
          }
        }
      }
    }
  }
}

/**
 * Synthesize speech using Amazon Polly
 */
export async function synthesizeSpeech(
  text: string,
  voiceId: string = "Kazuha"
): Promise<Buffer> {
  const command = new SynthesizeSpeechCommand({
    Text: text,
    VoiceId: voiceId as VoiceId,
    OutputFormat: OutputFormat.PCM,
    Engine: Engine.NEURAL,
    LanguageCode: "ja-JP",
    SampleRate: "16000",
  });

  const response = await pollyClient.send(command);

  if (!response.AudioStream) {
    throw new Error("No audio stream from Polly");
  }

  // Convert stream to buffer
  const chunks: Uint8Array[] = [];
  const reader = response.AudioStream.transformToWebStream().getReader();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  return Buffer.concat(chunks);
}

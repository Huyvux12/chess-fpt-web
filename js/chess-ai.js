/**
 * Chess GPT Web - AI Module
 * Uses ONNX Runtime Web for inference
 */

const DIFFICULTY_CONFIG = {
    easy: { temperature: 1.5, topK: 10, description: 'Dễ' },
    normal: { temperature: 0.8, topK: 40, description: 'Thường' },
    hard: { temperature: 0.3, topK: 50, description: 'Khó' }
};

class ChessAI {
    constructor() {
        this.session = null;
        this.tokenizer = null;
        this.isReady = false;
        this.modelUrl = 'https://huggingface.co/huyvux3005/chessfpt-uci-3ep-5m/resolve/main/onnx/model.onnx';
        this.tokenizerUrl = 'https://huggingface.co/huyvux3005/chessfpt-uci-3ep-5m/resolve/main/tokenizer.json';
    }

    async init(progressCallback) {
        if (this.isReady) return;

        try {
            if (progressCallback) progressCallback(5, 'Đang khởi tạo...');

            // Use global ort object (loaded from script tag)
            if (typeof ort === 'undefined') {
                throw new Error('ONNX Runtime not loaded. Check script tag.');
            }

            if (progressCallback) progressCallback(15, 'Đang tải tokenizer...');

            // Load tokenizer
            const tokenizerResponse = await fetch(this.tokenizerUrl);
            const tokenizerData = await tokenizerResponse.json();
            this.tokenizer = this.buildTokenizer(tokenizerData);

            if (progressCallback) progressCallback(30, 'Đang tải model (67MB)...');

            // Load ONNX model using global ort
            this.session = await ort.InferenceSession.create(this.modelUrl, {
                executionProviders: ['wasm'],
                graphOptimizationLevel: 'all'
            });

            if (progressCallback) progressCallback(95, 'Hoàn tất!');

            this.isReady = true;
            console.log('Chess AI loaded successfully!');
            return true;

        } catch (error) {
            console.error('Failed to load AI:', error);
            throw error;
        }
    }

    buildTokenizer(data) {
        const vocab = {};
        const reverseVocab = {};

        if (data.model && data.model.vocab) {
            Object.entries(data.model.vocab).forEach(([token, id]) => {
                vocab[token] = id;
                reverseVocab[id] = token;
            });
        }

        return {
            vocab,
            reverseVocab,
            padId: vocab['<PAD>'] || 0,
            bosId: vocab['<BOS>'] || 1,
            eosId: vocab['<EOS>'] || 2,
            unkId: vocab['<UNK>'] || 3,

            encode(text) {
                const tokens = text.trim().split(/\s+/).filter(t => t);
                const ids = [this.bosId];
                tokens.forEach(t => ids.push(vocab[t] ?? this.unkId));
                return ids;
            },

            decode(ids) {
                return ids
                    .map(id => reverseVocab[id] || '')
                    .filter(t => !['<PAD>', '<BOS>', '<EOS>', '<UNK>'].includes(t))
                    .join(' ');
            }
        };
    }

    async getMove(moveHistory, difficulty = 'normal') {
        if (!this.isReady) throw new Error('AI not loaded');

        const config = DIFFICULTY_CONFIG[difficulty];
        const inputIds = this.tokenizer.encode(moveHistory || '');

        try {
            // Create input tensor
            const inputTensor = new ort.Tensor('int64',
                BigInt64Array.from(inputIds.map(BigInt)),
                [1, inputIds.length]
            );

            // Run inference
            const feeds = { input_ids: inputTensor };
            const results = await this.session.run(feeds);

            // Get logits from output
            const logits = results.logits || results[Object.keys(results)[0]];
            const logitsData = logits.data;

            // Get last position logits
            const vocabSize = this.tokenizer.vocab ? Object.keys(this.tokenizer.vocab).length : 8068;
            const lastLogits = logitsData.slice(-vocabSize);

            // Apply temperature and sample
            const nextTokenId = this.sampleToken(lastLogits, config.temperature, config.topK);
            const nextMove = this.tokenizer.reverseVocab[nextTokenId];

            if (nextMove && this.isValidUCIMove(nextMove)) {
                return nextMove;
            }

            // Fallback: get top prediction
            const topId = this.argmax(lastLogits);
            const topMove = this.tokenizer.reverseVocab[topId];

            if (topMove && this.isValidUCIMove(topMove)) {
                return topMove;
            }

            throw new Error('No valid move generated');

        } catch (error) {
            console.error('Move generation error:', error);
            throw error;
        }
    }

    sampleToken(logits, temperature, topK) {
        // Apply temperature
        const scaled = Array.from(logits).map(l => l / temperature);

        // Get top-k indices
        const indexed = scaled.map((v, i) => ({ v, i }));
        indexed.sort((a, b) => b.v - a.v);
        const topKItems = indexed.slice(0, topK);

        // Softmax
        const maxVal = topKItems[0].v;
        const exps = topKItems.map(item => Math.exp(item.v - maxVal));
        const sum = exps.reduce((a, b) => a + b, 0);
        const probs = exps.map(e => e / sum);

        // Sample
        const rand = Math.random();
        let cumSum = 0;
        for (let i = 0; i < probs.length; i++) {
            cumSum += probs[i];
            if (rand < cumSum) return topKItems[i].i;
        }
        return topKItems[0].i;
    }

    argmax(arr) {
        let maxIdx = 0;
        let maxVal = arr[0];
        for (let i = 1; i < arr.length; i++) {
            if (arr[i] > maxVal) {
                maxVal = arr[i];
                maxIdx = i;
            }
        }
        return maxIdx;
    }

    isValidUCIMove(move) {
        if (!move || typeof move !== 'string') return false;
        return /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move);
    }

    getDifficultyConfig(difficulty) {
        return DIFFICULTY_CONFIG[difficulty] || DIFFICULTY_CONFIG.normal;
    }
}

const chessAI = new ChessAI();
export default chessAI;
export { ChessAI, DIFFICULTY_CONFIG };

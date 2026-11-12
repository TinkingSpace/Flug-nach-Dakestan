(() => {
    "use strict";

    const GameState = Object.freeze({
        MENU: "menu",
        PLAYING: "playing",
        PAUSED: "paused",
        GAME_OVER: "game-over"
    });

    class InputController {
        constructor() {
            this.actions = new Set();
            this.justPressed = new Set();
            this.justReleased = new Set();

            this.keyMap = {
                ArrowLeft: "left", a: "left", A: "left",
                ArrowRight: "right", d: "right", D: "right",
                ArrowUp: "up", w: "up", W: "up",
                ArrowDown: "down", s: "down", S: "down",
                Space: "fire", " ": "fire",
                KeyQ: "shockwave", q: "shockwave", Q: "shockwave",
                Escape: "pause"
            };

            window.addEventListener("keydown", event => {
                const action = this.keyMap[event.code] || this.keyMap[event.key];

                if (!action) return;

                if ([
                    "left", "right", "up", "down",
                    "fire", "shockwave"
                ].includes(action)) {
                    event.preventDefault();
                }

                if (!this.actions.has(action)) {
                    this.justPressed.add(action);
                }

                this.actions.add(action);
            });

            window.addEventListener("keyup", event => {
                const action = this.keyMap[event.code] || this.keyMap[event.key];

                if (!action) return;

                this.actions.delete(action);
                this.justReleased.add(action);
            });

            window.addEventListener("blur", () => this.clear());
        }

        isDown(action) {
            return this.actions.has(action);
        }

        consume(action) {
            if (!this.justPressed.has(action)) return false;

            this.justPressed.delete(action);
            return true;
        }

        consumeReleased(action) {
            if (!this.justReleased.has(action)) return false;

            this.justReleased.delete(action);
            return true;
        }

        set(action, isDown) {
            if (isDown) {
                if (!this.actions.has(action)) {
                    this.justPressed.add(action);
                }

                this.actions.add(action);
            } else {
                if (this.actions.has(action)) {
                    this.justReleased.add(action);
                }

                this.actions.delete(action);
            }
        }

        endFrame() {
            this.justPressed.clear();
            this.justReleased.clear();
        }

        clear() {
            for (const action of this.actions) {
                this.justReleased.add(action);
            }

            this.actions.clear();
            this.justPressed.clear();
        }
    }

    class Storage {
        static number(key, fallback = 0) {
            try {
                const raw = localStorage.getItem(key);
                if (raw === null) return fallback;
                const value = Number(raw);
                return Number.isFinite(value) && value >= 0 ? value : fallback;
            } catch {
                return fallback;
            }
        }

        static flag(key) {
            try {
                return localStorage.getItem(key) === "true";
            } catch {
                return false;
            }
        }

        static saveNumber(key, value) {
            try {
                localStorage.setItem(
                    key,
                    String(Math.max(0, Math.floor(value)))
                );
            } catch {}
        }
    }

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function random(min, max) {
        return Math.random() * (max - min) + min;
    }

    function overlaps(first, second) {
        const a = first.getBounds();
        const b = second.getBounds();

        return (
            a.x < b.x + b.width &&
            a.x + a.width > b.x &&
            a.y < b.y + b.height &&
            a.y + a.height > b.y
        );
    }

    window.PixelWolfCore = {
        GameState,
        InputController,
        Storage,
        clamp,
        random,
        overlaps
    };
})();
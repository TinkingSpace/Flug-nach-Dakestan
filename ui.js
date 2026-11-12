(() => {
    "use strict";

    document.title = "Flug nach Dakestan";

    const stylesheet = document.createElement("style");

    stylesheet.textContent = `
        :root {
            color-scheme: dark;
        }

        html, body {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
            overflow-x: hidden;
        }

        body {
            overflow-y: hidden;
        }

        canvas {
            display: block;
            max-width: 100vw;
        }

        #pixelwolf-overlay {
            overflow-x: hidden;
            box-sizing: border-box;
            padding: 12px;
            position: fixed;
            inset: 0;
            z-index: 10;
            display: grid;
            place-items: center;
            background: radial-gradient(
                ellipse at 50% 40%,
                rgba(18,56,116,.88),
                rgba(2,4,13,.96)
            );
            font-family: Arial, sans-serif;
            color: #f4fbff;
            text-align: center;
        }

        #pixelwolf-overlay[hidden] {
            display: none;
        }

        .pixelwolf-panel {
            width: min(720px, 94vw);
            max-height: calc(100vh - 32px);
            overflow-y: auto;
            padding: clamp(20px, 4vw, 36px);
            box-sizing: border-box;
            border: 1px solid rgba(56, 215, 255, 0.75);
            border-radius: 20px;
            background: radial-gradient(
                ellipse at 50% 0%,
                rgba(8, 30, 72, 0.94),
                rgba(3, 11, 32, 0.96)
            );
            box-shadow:
                0 0 55px rgba(0, 161, 255, 0.42),
                inset 0 0 40px rgba(15, 90, 180, 0.25);
            backdrop-filter: blur(8px);
        }

        .pixelwolf-panel::-webkit-scrollbar {
            width: 6px;
        }

        .pixelwolf-panel::-webkit-scrollbar-thumb {
            background: rgba(56, 215, 255, 0.4);
            border-radius: 4px;
        }

        .pixelwolf-panel h1 {
            margin: 0 0 6px;
            font-size: clamp(34px, 8vw, 56px);
            letter-spacing: .08em;
            color: #e4f9ff;
            text-shadow:
                0 0 14px #00bfff,
                0 0 32px #0873e8;
            line-height: 1.1;
        }

        .pixelwolf-panel h2 {
            margin: 0 0 14px;
            color: #55ddff;
            font-size: 16px;
            letter-spacing: .12em;
        }

        .pixelwolf-panel p {
            line-height: 1.5;
            color: #bcecff;
            margin: 0 0 12px;
        }

        .pixelwolf-panel .stat {
            color: #ffd95c;
            font-size: 24px;
            font-weight: 700;
            margin: 6px 0 12px;
        }

        .menu-stats {
            display: flex;
            justify-content: center;
            gap: 10px;
            flex-wrap: wrap;
            margin: 14px 0 18px;
        }

        .menu-stat-pill {
            background: rgba(14, 52, 102, 0.65);
            border: 1px solid rgba(66, 223, 255, 0.45);
            border-radius: 20px;
            padding: 7px 16px;
            font-size: 14px;
            font-weight: 700;
            color: #e5f7ff;
            letter-spacing: .04em;
        }

        .menu-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 11px;
            margin-top: 10px;
        }

        .cards-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(195px, 1fr));
            gap: 12px;
            margin: 14px 0;
        }

        .upgrade-card {
            margin: 0;
            padding: 14px;
            border: 1px solid rgba(74, 214, 255, .58);
            border-radius: 12px;
            background: rgba(12, 56, 104, .45);
            text-align: left;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
        }

        .upgrade-card h3 {
            margin: 0 0 6px;
            color: #e9fbff;
            font-size: 16px;
        }

        .upgrade-card p {
            margin: 0 0 10px;
            font-size: 13px;
            flex-grow: 1;
        }

        .upgrade-card button {
            margin: 0;
            min-height: 40px;
            font-size: 12px;
        }

        .pixelwolf-panel button {
            width: 100%;
            min-height: 48px;
            margin: 6px 0;
            border: 1px solid #38d7ff;
            border-radius: 10px;
            color: white;
            background: linear-gradient(
                110deg,
                #063875,
                #087fc0,
                #063875
            );
            font: 700 14px Arial, sans-serif;
            letter-spacing: .08em;
            cursor: pointer;
            transition: transform .15s, filter .15s, box-shadow .15s;
            box-sizing: border-box;
        }

        .pixelwolf-panel button.btn-primary {
            min-height: 54px;
            font-size: 17px;
            background: linear-gradient(
                110deg,
                #0a4fb5,
                #00bfff,
                #0a4fb5
            );
            border-color: #8ce9ff;
            box-shadow: 0 0 24px rgba(0, 191, 255, 0.4);
            margin: 8px 0;
        }

        .pixelwolf-panel button:hover:not(:disabled) {
            transform: translateY(-2px);
            filter: brightness(1.22);
            box-shadow: 0 0 16px rgba(56, 215, 255, 0.4);
        }

        .pixelwolf-panel button:disabled {
            cursor: not-allowed;
            opacity: .48;
            filter: grayscale(0.4);
        }

        .pixelwolf-panel .back {
            margin-top: 16px;
            background: #142442;
            border-color: rgba(70, 150, 220, 0.6);
        }

        #pixelwolf-toast {
            position: fixed;
            top: 22px;
            left: 50%;
            z-index: 20;
            transform: translate(-50%, -12px);
            padding: 10px 16px;
            border: 1px solid #71e5ff;
            border-radius: 8px;
            background: rgba(4,26,57,.94);
            color: #e7fbff;
            font: 700 14px Arial, sans-serif;
            opacity: 0;
            pointer-events: none;
            transition: .2s;
        }

        #pixelwolf-toast.visible {
            opacity: 1;
            transform: translate(-50%, 0);
        }

        #pixelwolf-touch {
            position: fixed;
            inset: auto 0 16px;
            z-index: 5;
            display: none;
            justify-content: space-between;
            align-items: end;
            padding: 0 16px;
            pointer-events: none;
        }

        #pixelwolf-touch .cluster {
            display: grid;
            grid-template-columns: repeat(3, 52px);
            gap: 7px;
            pointer-events: auto;
        }

        #pixelwolf-touch button {
            width: 52px;
            height: 52px;
            border: 1px solid #5ce1ff;
            border-radius: 50%;
            background: rgba(4,47,92,.8);
            color: #fff;
            font-size: 19px;
            touch-action: none;
        }

        #pixelwolf-touch .up {
            grid-column: 2;
        }

        #pixelwolf-touch .left {
            grid-column: 1;
            grid-row: 2;
        }

        #pixelwolf-touch .down {
            grid-column: 2;
            grid-row: 2;
        }

        #pixelwolf-touch .right {
            grid-column: 3;
            grid-row: 2;
        }

        #pixelwolf-touch .actions {
            display: flex;
            gap: 9px;
            pointer-events: auto;
        }

        #pixelwolf-touch .actions button {
            width: 68px;
            height: 68px;
            font-size: 13px;
            font-weight: 700;
        }

        @media (pointer: coarse), (max-width: 760px) {
            #pixelwolf-touch.active {
                display: flex;
            }
        }

        @media (prefers-reduced-motion: reduce) {
            * {
                scroll-behavior: auto !important;
                transition: none !important;
            }
        }
    `;

    document.head.appendChild(stylesheet);

    class GameUI {
        constructor(actions) {
            this.actions = actions;

            this.overlay = document.createElement("section");
            this.overlay.id = "pixelwolf-overlay";
            this.overlay.setAttribute("aria-live", "polite");

            document.body.appendChild(this.overlay);

            this.toast = document.createElement("div");
            this.toast.id = "pixelwolf-toast";

            document.body.appendChild(this.toast);

            this.toastTimer = null;

            this.touch = document.createElement("div");
            this.touch.id = "pixelwolf-touch";

            this.touch.innerHTML = `
                <div class="cluster" aria-label="Bewegung">
                    <button class="up" data-action="up"
                        aria-label="Nach oben">▲</button>

                    <button class="left" data-action="left"
                        aria-label="Nach links">◀</button>

                    <button class="down" data-action="down"
                        aria-label="Nach unten">▼</button>

                    <button class="right" data-action="right"
                        aria-label="Nach rechts">▶</button>
                </div>

                <div class="actions">
                    <button data-action="shockwave"
                        aria-label="Schockwelle">💥</button>

                    <button data-action="fire"
                        aria-label="Feuern">FIRE</button>
                </div>
            `;

            document.body.appendChild(this.touch);

            this.connectTouchButtons();
        }

        connectTouchButtons() {
            this.touch.querySelectorAll(
                "button[data-action]"
            ).forEach(button => {

                const action = button.dataset.action;

                const start = event => {
                    event.preventDefault();
                    this.actions.set(action, true);
                };

                const end = event => {
                    event.preventDefault();
                    this.actions.set(action, false);
                };

                button.addEventListener("pointerdown", start);
                button.addEventListener("pointerup", end);
                button.addEventListener("pointercancel", end);
                button.addEventListener("pointerleave", end);
            });
        }

        showMainMenu(progress) {
            this.touch.classList.remove("active");
            this.overlay.hidden = false;

            this.overlay.innerHTML = `
                <div class="pixelwolf-panel">
                    <h1>FLUG NACH<br>DAKESTAN</h1>
                    <h2>MISSION WELTRAUM</h2>

                    <div class="menu-stats">
                        <span class="menu-stat-pill">🪙 ${progress.coins} Münzen</span>
                        <span class="menu-stat-pill">🏆 Rekord: ${progress.highscore}</span>
                        <span class="menu-stat-pill">⭐ Level ${progress.level} (${progress.xpInLevel}/100 XP)</span>
                    </div>

                    <p>
                        Verteidige dein Schiff, sammle Münzen und verbessere deine Ausrüstung.
                    </p>

                    <button class="btn-primary" data-command="play">
                        ▶ SPIELEN
                    </button>

                    <div class="menu-grid">
                        <button data-command="shop">
                            🛒 SHOP · ${progress.coins} 🪙
                        </button>

                        <button data-command="upgrades">
                            ⬆ UPGRADES
                        </button>

                        <button data-command="new">
                            ✦ NEUE RUNDE
                        </button>

                        <button data-command="settings">
                            ⚙ STEUERUNG
                        </button>
                    </div>
                </div>
            `;

            this.bindOverlay();
        }

        showUpgradeMenu(progress) {
            this.touch.classList.remove("active");
            const cards = progress.upgradeOptions.map(upgrade => {

                const maxed = upgrade.level >= upgrade.maxLevel;
                const affordable = progress.coins >= upgrade.cost;

                const label = maxed
                    ? "✓ MAXIMALE STUFE"
                    : affordable
                        ? `⬆ FÜR ${upgrade.cost} MÜNZEN`
                        : `🔒 NOCH ${upgrade.cost - progress.coins} MÜNZEN`;

                return `
                    <article class="upgrade-card">
                        <h3>
                            ${upgrade.icon}
                            ${upgrade.name}
                            <span style="font-size:13px; color:#55ddff;">(${upgrade.level}/${upgrade.maxLevel})</span>
                        </h3>

                        <p>${upgrade.description}</p>

                        <button
                            data-command="buy-upgrade"
                            data-upgrade="${upgrade.id}"
                            ${maxed || !affordable ? "disabled" : ""}
                        >
                            ${label}
                        </button>
                    </article>
                `;
            }).join("");

            this.overlay.hidden = false;

            this.overlay.innerHTML = `
                <div class="pixelwolf-panel">
                    <h1>UPGRADES</h1>
                    <h2>DAUERHAFTE SCHIFFS-VERBESSERUNGEN</h2>

                    <div class="menu-stats">
                        <span class="menu-stat-pill">🪙 ${progress.coins} Münzen verfügbar</span>
                    </div>

                    <p style="font-size: 13px; color: #9fe2ff;">
                        Jede nächste Stufe kostet 20 % mehr (max. 5 Stufen).<br>
                        <em>Tipp: Beim Kauf eines neuen Raketen-Skins werden diese Upgrades zurückgesetzt und können für den neuen Skin neu gekauft werden!</em>
                    </p>

                    <div class="cards-grid">
                        ${cards}
                    </div>

                    <button class="back" data-command="menu">
                        ← ZURÜCK ZUM MENÜ
                    </button>
                </div>
            `;

            this.bindOverlay();
        }

        showPause(progress) {
            this.touch.classList.remove("active");
            this.overlay.hidden = false;

            this.overlay.innerHTML = `
                <div class="pixelwolf-panel">
                    <h1>PAUSE</h1>
                    <h2>MISSION UNTERBROCHEN</h2>

                    <p class="stat">${progress.score} Punkte</p>

                    <p>
                        Level ${progress.level}
                        · ${progress.xpInLevel} / 100 XP
                    </p>

                    <button data-command="resume">
                        ▶ WEITERSPIELEN
                    </button>

                    <button data-command="restart">
                        ↻ RUNDE NEU STARTEN
                    </button>

                    <button class="back" data-command="menu">
                        ⌂ ZUR LOBBY
                    </button>
                </div>
            `;

            this.bindOverlay();
        }

        showGameOver(progress) {
            this.touch.classList.remove("active");
            this.overlay.hidden = false;

            this.overlay.innerHTML = `
                <div class="pixelwolf-panel">
                    <h1>GAME OVER</h1>
                    <h2>DEINE RUNDE</h2>

                    <p class="stat">${progress.score} Punkte</p>

                    <p>
                        Rekord: ${progress.highscore}
                        · Münzen: ${progress.coins}
                    </p>

                    <button data-command="restart">
                        ↻ NOCH EINE RUNDE
                    </button>

                    <button class="back" data-command="menu">
                        ⌂ ZUR LOBBY
                    </button>
                </div>
            `;

            this.bindOverlay();
        }

        showShop(progress) {
            this.touch.classList.remove("active");
            const remaining = Math.max(
                0,
                progress.chargedPrice - progress.coins
            );

            const label = progress.chargedUnlocked
                ? "✓ FREIGESCHALTET"
                : progress.coins >= progress.chargedPrice
                    ? `⚡ FÜR ${progress.chargedPrice} MÜNZEN`
                    : `🔒 NOCH ${remaining} MÜNZEN`;

            const chargedCard = `
                <article class="upgrade-card">
                    <h3>⚡ Energieschuss</h3>
                    <p>Halte FEUER gedrückt: Bis zu 3 Schaden durch gezielte Energieaufladung.</p>
                    <button
                        data-command="buy"
                        ${
                            progress.chargedUnlocked ||
                            progress.coins < progress.chargedPrice
                                ? "disabled"
                                : ""
                        }
                    >
                        ${label}
                    </button>
                </article>
            `;

            const shotItems = [
                {
                    id: "double",
                    name: "Doppelschuss",
                    price: 90,
                    unlocked: progress.doubleShotUnlocked,
                    command: "buy-double",
                    desc: "Feuert 2 Projektile nebeneinander ab. Kostet 1 Waffen-Energie pro Salve."
                },
                {
                    id: "triple",
                    name: "Dreifachschuss",
                    price: 150,
                    unlocked: progress.tripleShotUnlocked,
                    command: "buy-triple",
                    desc: "Feuert 3 Projektile nebeneinander ab. Erst nach dem Doppelschuss kaufbar."
                }
            ].map(item => `
                <article class="upgrade-card">
                    <h3>🚀 ${item.name}</h3>
                    <p>${item.desc}</p>

                    <button
                        data-command="${item.command}"
                        ${
                            item.unlocked ||
                            progress.coins < item.price ||
                            (item.id === "triple" && !progress.doubleShotUnlocked)
                                ? "disabled"
                                : ""
                        }
                    >
                        ${
                            item.unlocked
                                ? "✓ FREIGESCHALTET"
                                : `FÜR ${item.price} MÜNZEN`
                        }
                    </button>
                </article>
            `).join("");

            const skinCards = (progress.skinOptions || []).map(skin => {
                let action = "";

                if (skin.unlocked) {
                    action = `
                        <div style="display:flex; flex-direction:column; gap:6px;">
                            <button
                                data-command="upgrade-skin"
                                data-upgrade="${skin.id}"
                                ${
                                    skin.upgradeLevel >= 5 ||
                                    progress.coins < skin.upgradeCost
                                        ? "disabled"
                                        : ""
                                }
                            >
                                ${
                                    skin.upgradeLevel >= 5
                                        ? "✓ MAX. STUFE"
                                        : `⬆ STUFE (+1) · ${skin.upgradeCost} 🪙`
                                }
                            </button>

                            <button
                                data-command="equip-skin"
                                data-upgrade="${skin.id}"
                                style="${skin.equipped ? 'background:#1a4b75;' : ''}"
                                ${skin.equipped ? "disabled" : ""}
                            >
                                ${
                                    skin.equipped
                                        ? "✓ AKTIV"
                                        : "AUSRÜSTEN"
                                }
                            </button>
                        </div>
                    `;
                } else {
                    const ready =
                        progress.level >= skin.level &&
                        skin.previousMaxed &&
                        progress.coins >= skin.price;

                    const reason =
                        progress.level < skin.level
                            ? `Level ${skin.level} nötig`
                            : !skin.previousMaxed
                                ? "Vorherigen Skin auf Stufe 5 bringen"
                                : `${skin.price} Münzen nötig`;

                    action = `
                        <button
                            data-command="buy-skin"
                            data-upgrade="${skin.id}"
                            ${ready ? "" : "disabled"}
                        >
                            ${
                                ready
                                    ? `FÜR ${skin.price} 🪙 FREISCHALTEN`
                                    : `🔒 ${reason}`
                            }
                        </button>
                    `;
                }

                return `
                    <article class="upgrade-card">
                        <h3>
                            🚀 ${skin.name}
                            <span style="font-size:13px; color:#55ddff;">(Stufe ${skin.upgradeLevel}/5)</span>
                        </h3>

                        <p>
                            ${
                                skin.unlocked
                                    ? (skin.equipped ? "🌟 Aktuell ausgerüstet." : "Freigeschaltet & bereit.")
                                    : `Ab Spieler-Level ${skin.level}. Vorheriger Skin muss Stufe 5 sein.`
                            }
                        </p>

                        ${action}
                    </article>
                `;
            }).join("");

            this.overlay.hidden = false;

            this.overlay.innerHTML = `
                <div class="pixelwolf-panel">
                    <h1>SHOP</h1>
                    <h2>WAFFENSYSTEME & RAKETEN-SKINS</h2>

                    <div class="menu-stats">
                        <span class="menu-stat-pill">🪙 ${progress.coins} Münzen</span>
                        <span class="menu-stat-pill">⭐ Spieler-Level ${progress.level}</span>
                    </div>

                    <h3 style="margin: 12px 0 6px; color:#55ddff; text-align:left; font-size:16px;">⚡ WAFFEN-UPGRADES</h3>
                    <div class="cards-grid">
                        ${chargedCard}
                        ${shotItems}
                    </div>

                    <h3 style="margin: 16px 0 6px; color:#55ddff; text-align:left; font-size:16px;">🚀 RAKETEN-SKINS</h3>
                    <p style="font-size: 13px; color: #9fe2ff; text-align:left;">
                        Jeder Skin kann bis Stufe 5 verbessert werden. <em>Hinweis: Wenn du einen neuen Skin kaufst, werden die Schiffs-Upgrades zurückgesetzt, damit du sie für deinen neuen Skin neu aufbauen kannst!</em>
                    </p>
                    <div class="cards-grid">
                        ${skinCards}
                    </div>

                    <button class="back" data-command="menu">
                        ← ZURÜCK ZUM MENÜ
                    </button>
                </div>
            `;

            this.bindOverlay();
        }

        showSettings() {
            this.touch.classList.remove("active");
            this.overlay.hidden = false;

            this.overlay.innerHTML = `
                <div class="pixelwolf-panel">
                    <h1>STEUERUNG</h1>
                    <h2>TASTENBELEGUNG & BEDIENUNG</h2>

                    <div class="cards-grid" style="grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); text-align:left;">
                        <article class="upgrade-card">
                            <h3>⌨ TASTATUR</h3>
                            <p>
                                <strong>Bewegen:</strong> WASD oder Pfeiltasten<br>
                                <strong>Feuern:</strong> Leertaste<br>
                                <strong>Energieschuss:</strong> Leertaste halten & loslassen<br>
                                <strong>Schockwelle:</strong> Taste Q<br>
                                <strong>Pause:</strong> Esc (auch zum Weiterspielen)
                            </p>
                        </article>

                        <article class="upgrade-card">
                            <h3>📱 TOUCH & SMARTPHONE</h3>
                            <p>
                                <strong>D-Pad links:</strong> Bewegung ▲ ◀ ▼ ▶<br>
                                <strong>FIRE rechts:</strong> Schießen / Aufladen<br>
                                <strong>💥 rechts:</strong> Schockwelle auslösen<br>
                                Auf Touch-Geräten werden Tasten automatisch eingeblendet.
                            </p>
                        </article>
                    </div>

                    <button class="back" data-command="menu">
                        ← ZURÜCK ZUM MENÜ
                    </button>
                </div>
            `;

            this.bindOverlay();
        }

        bindOverlay() {
            this.overlay.querySelectorAll(
                "button[data-command]"
            ).forEach(button => {
                button.addEventListener("click", () => {
                    this.onCommand(
                        button.dataset.command,
                        button.dataset.upgrade
                    );
                });
            });
        }

        setCommandHandler(handler) {
            this.onCommand = handler;
        }

        hideOverlay() {
            this.overlay.hidden = true;
            this.touch.classList.add("active");
        }

        hideTouch() {
            this.touch.classList.remove("active");
        }

        notify(message) {
            this.toast.textContent = message;
            this.toast.classList.add("visible");

            clearTimeout(this.toastTimer);

            this.toastTimer = setTimeout(() => {
                this.toast.classList.remove("visible");
            }, 2200);
        }
    }

    window.PixelWolfUI = { GameUI };
})();
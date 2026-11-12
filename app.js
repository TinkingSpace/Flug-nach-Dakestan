
(() => {
    "use strict";

    const { GameState, InputController, Storage, clamp, random, overlaps } = window.PixelWolfCore;
    const { GameUI } = window.PixelWolfUI;

    const COLORS = {
        space: 0x050816,
        cyan: 0x42dfff,
        blue: 0x008cff,
        green: 0x00ff88,
        gold: 0xffd700,
        white: 0xffffff
    };

    function loadSkinList() {
        try {
            const saved = JSON.parse(localStorage.getItem("pixelwolfUnlockedSkins") || '["default"]');
            return Array.isArray(saved) && saved.includes("default") ? saved : ["default"];
        } catch { return ["default"]; }
    }

    /**
     * PIXELWOLF's complete game coordinator. Every temporary game object is
     * registered in a collection and destroyed by resetRun(), so a new round
     * never relies on a page reload or leaves stale intervals behind.
     */
    class PixelWolfGame {
        constructor() {
            this.app = new PIXI.Application({
                resizeTo: window,
                backgroundColor: COLORS.space,
                antialias: true
            });
            document.body.appendChild(this.app.view);

            this.input = new InputController();
            this.ui = new GameUI(this.input);
            this.ui.setCommandHandler((command, value) => this.handleCommand(command, value));

            this.state = GameState.MENU;
            this.asteroidLayer = new PIXI.Container();
            this.world = new PIXI.Container();
            this.fxLayer = new PIXI.Container();
            this.hud = new PIXI.Container();

            // Reihenfolge bestimmt die Ebenen:
            // Hintergrund → Asteroiden → Spielobjekte → Effekte → HUD
            this.app.stage.addChild(
                this.createBackground(),
                this.asteroidLayer,
                this.world,
                this.fxLayer,
                this.hud
            );

            this.enemies = [];
            this.asteroids = [];
            this.bullets = [];
            this.enemyBullets = [];
            this.coinsOnScreen = [];
            this.powerUps = [];
            this.effects = [];
            this.trails = [];
            this.player = null;

            this.progress = {
                coins: Storage.number("pixelwolfCoins"),
                highscore: Storage.number("pixelwolfHighscore"),
                totalXP: Storage.number("pixelwolfTotalXP"),
                chargedUnlocked: Storage.flag("pixelwolfChargedShotUnlocked"),
                doubleShotUnlocked: Storage.flag("pixelwolfDoubleShotUnlocked"),
                tripleShotUnlocked: Storage.flag("pixelwolfTripleShotUnlocked"),
                asteroidDestroyerUnlocked: Storage.flag("pixelwolfAsteroidDestroyerUnlocked"),
                unlockedSkins: loadSkinList(),
                equippedSkin: localStorage.getItem("pixelwolfEquippedSkin") || "default",
                skinLevels: {
                    default: clamp(Storage.number("pixelwolfSkinLevelDefault"), 0, 5),
                    solar: clamp(Storage.number("pixelwolfSkinLevelSolar"), 0, 5),
                    plasma: clamp(Storage.number("pixelwolfSkinLevelPlasma"), 0, 5),
                    shadow: clamp(Storage.number("pixelwolfSkinLevelShadow"), 0, 5)
                },
                upgrades: {
                    fireRate: clamp(Storage.number("pixelwolfUpgradeFireRate"), 0, 5),
                    magnet: clamp(Storage.number("pixelwolfUpgradeMagnet"), 0, 5),
                    movement: clamp(Storage.number("pixelwolfUpgradeMovement"), 0, 5)
                }
            };

            this.chargedPrice = 60;
            this.maxUpgradeLevel = 5;
            this.upgradeBasePrice = 20;
            this.score = 0;
            this.energy = 3;
            this.maxEnergy = 3;
            this.shields = 3;
            this.maxShields = 3;
            this.invulnerableTimer = 0;
            this.saveTimer = null;
            this.runLevel = 1;
            this.shockwaves = 0;
            this.chargeTime = 0;
            this.isCharging = false;
            this.fireCooldown = 0;
            this.energyRecharge = 0;
            this.trailCooldown = 0;
            this.spawnTimers = {};

            this.createHud();
            this.resetSpawnTimers();
            this.updateHud();
            this.ui.showMainMenu(this.getProgress());

            window.addEventListener("resize", () => this.onResize());
            this.app.ticker.add(delta => this.update(Math.min(0.05, delta / 60)));
        }

        // ---------- Screen and saved progress ----------

        get playerLevel() {
            return Math.floor(this.progress.totalXP / 100) + 1;
        }

        getProgress() {
            return {
                ...this.progress,
                score: this.score,
                level: this.playerLevel,
                xpInLevel: this.progress.totalXP % 100,
                chargedPrice: this.chargedPrice,
                upgradeOptions: this.getUpgradeOptions(),
                doubleShotUnlocked: this.progress.doubleShotUnlocked,
                tripleShotUnlocked: this.progress.tripleShotUnlocked,
                unlockedSkins: this.progress.unlockedSkins,
                equippedSkin: this.progress.equippedSkin,
                skinLevels: this.progress.skinLevels,
                skinOptions: this.getSkinOptions()
            };
        }

        getSkinOptions() {
            const skins = [
                { id: "default", name: "Standard", level: 1, price: 0, tint: 0xffffff },
                { id: "solar", name: "Solar", level: 5, price: 100, tint: 0xffb347 },
                { id: "plasma", name: "Plasma", level: 10, price: 160, tint: 0x62eaff },
                { id: "shadow", name: "Shadow", level: 20, price: 240, tint: 0xb69cff }
            ];

            return skins.map((skin, index) => ({
                ...skin,
                upgradeLevel: this.progress.skinLevels[skin.id],
                unlocked: this.progress.unlockedSkins.includes(skin.id),
                previousMaxed: index === 0 || this.progress.skinLevels[skins[index - 1].id] >= 5,
                equipped: this.progress.equippedSkin === skin.id,
                upgradeCost: 40 + this.progress.skinLevels[skin.id] * 20
            }));
        }

        getUpgradeOptions() {
            const { fireRate, magnet, movement } = this.progress.upgrades;

            return [
                {
                    id: "fireRate",
                    icon: "⚡",
                    name: "Feuergeschwindigkeit",
                    level: fireRate,
                    maxLevel: this.maxUpgradeLevel,
                    cost: this.getUpgradeCost("fireRate"),
                    description: `Feuerrate: +${this.getUpgradeBonus(fireRate)} % gegenüber dem Grundwert.`
                },
                {
                    id: "magnet",
                    icon: "🧲",
                    name: "Münzmagnet",
                    level: magnet,
                    maxLevel: this.maxUpgradeLevel,
                    cost: this.getUpgradeCost("magnet"),
                    description: `Münzmagnet: +${this.getUpgradeBonus(magnet)} % Reichweite (${this.getMagnetRange()} Pixel).`
                },
                {
                    id: "movement",
                    icon: "🚀",
                    name: "Antrieb",
                    level: movement,
                    maxLevel: this.maxUpgradeLevel,
                    cost: this.getUpgradeCost("movement"),
                    description: `Bewegungsgeschwindigkeit: +${this.getUpgradeBonus(movement)} % gegenüber dem Grundwert.`
                }
            ];
        }

        // Jeder Kauf erhöht den Preis um 20 % gegenüber dem vorherigen Kauf.
        getUpgradeCost(upgradeId) {
            const level = this.progress.upgrades[upgradeId];
            if (level === undefined || level >= this.maxUpgradeLevel) return 0;
            return Math.ceil(this.upgradeBasePrice * (1.2 ** level));
        }

        // Gesamtbonus gegenüber dem Grundwert: Level 1 = +20 %, Level 2 = +44 % usw.
        getUpgradeBonus(level) {
            return Math.round(((1.2 ** level) - 1) * 100);
        }

        // Jede Stufe erhöht die Feuerrate um weitere 20 %.
        getFireCooldown(baseCooldown) {
            return baseCooldown / (1.2 ** this.progress.upgrades.fireRate);
        }

        // Der Magnetradius wächst bei jedem Kauf um weitere 20 %.
        getMagnetRange() {
            return Math.round(55 * (1.2 ** this.progress.upgrades.magnet));
        }

        scheduleSave() {
            if (this.saveTimer) return;
            this.saveTimer = setTimeout(() => {
                this.saveTimer = null;
                this.saveProgress();
            }, 350);
        }

        saveProgress() {
            if (this.saveTimer) {
                clearTimeout(this.saveTimer);
                this.saveTimer = null;
            }

            Storage.saveNumber("pixelwolfCoins", this.progress.coins);
            Storage.saveNumber("pixelwolfHighscore", this.progress.highscore);
            Storage.saveNumber("pixelwolfTotalXP", this.progress.totalXP);

            localStorage.setItem("pixelwolfChargedShotUnlocked", String(this.progress.chargedUnlocked));
            localStorage.setItem("pixelwolfDoubleShotUnlocked", String(this.progress.doubleShotUnlocked));
            localStorage.setItem("pixelwolfTripleShotUnlocked", String(this.progress.tripleShotUnlocked));
            localStorage.setItem(
            "pixelwolfAsteroidDestroyerUnlocked",
            String(this.progress.asteroidDestroyerUnlocked)
);
            localStorage.setItem("pixelwolfUnlockedSkins", JSON.stringify(this.progress.unlockedSkins));
            localStorage.setItem("pixelwolfEquippedSkin", this.progress.equippedSkin);

            for (const skin of ["default", "solar", "plasma", "shadow"]) {
                Storage.saveNumber(
                    `pixelwolfSkinLevel${skin[0].toUpperCase()}${skin.slice(1)}`,
                    this.progress.skinLevels[skin]
                );
            }

            Storage.saveNumber("pixelwolfUpgradeFireRate", this.progress.upgrades.fireRate);
            Storage.saveNumber("pixelwolfUpgradeMagnet", this.progress.upgrades.magnet);
            Storage.saveNumber("pixelwolfUpgradeMovement", this.progress.upgrades.movement);
        }

        onResize() {
            if (this.player) this.keepInBounds(this.player);
            this.drawBackgroundBounds();
        }

        // ---------- Hintergrund ----------

        createBackground() {
            this.background = new PIXI.Container();
            this.backgroundFill = new PIXI.Graphics();
            this.background.addChild(this.backgroundFill);

            this.nebulae = [];
            this.galaxies = [];
            this.blackHoles = [];
            this.stars = [];
            this.shootingStars = [];

            // Große, sehr transparente Nebelfelder im bisherigen dunkelblauen PixelWolf-Stil.
            for (let i = 0; i < 6; i += 1) {
                const nebula = new PIXI.Graphics();
                const color = [
                    0x173b83, 0x48256f, 0x075b78,
                    0x6b285f, 0x164c78, 0x34317c
                ][i];

                nebula.beginFill(color, 0.11);
                nebula.drawEllipse(0, 0, random(90, 210), random(55, 130));
                nebula.endFill();

                nebula.x = random(0, Math.max(1, window.innerWidth));
                nebula.y = random(0, Math.max(1, window.innerHeight));
                nebula.vx = random(-5, 5);
                nebula.vy = random(-3, 3);
                nebula.alpha = random(0.45, 0.9);

                this.nebulae.push(nebula);
                this.background.addChild(nebula);
            }

            // Kleine Spiralgalaxien aus elliptischen Ringen und einem hellen Kern.
            for (let i = 0; i < 3; i += 1) {
                const galaxy = new PIXI.Container();
                const color = [0x8c75ff, 0x54d9ff, 0xff8bd7][i];

                for (let ring = 0; ring < 3; ring += 1) {
                    const swirl = new PIXI.Graphics();
                    swirl.lineStyle(2 - ring * 0.35, color, 0.23 - ring * 0.045);
                    swirl.drawEllipse(0, 0, 30 + ring * 13, 9 + ring * 5);
                    swirl.rotation = ring * 0.55;
                    galaxy.addChild(swirl);
                }

                const core = new PIXI.Graphics();
                core.beginFill(0xffffff, 0.65);
                core.drawCircle(0, 0, 3.5);
                core.endFill();
                galaxy.addChild(core);

                galaxy.x = random(50, Math.max(51, window.innerWidth - 50));
                galaxy.y = random(40, Math.max(41, window.innerHeight - 40));
                galaxy.rotation = random(0, Math.PI);
                galaxy.spin = random(-0.035, 0.035);
                galaxy.scale.set(random(0.7, 1.35));

                this.galaxies.push(galaxy);
                this.background.addChild(galaxy);
            }

            // Schwarze Löcher mit sanfter Anziehungskraft.
            for (let i = 0; i < 2; i += 1) {
                const hole = new PIXI.Container();
                const halo = new PIXI.Graphics();

                halo.lineStyle(4, 0xa35cff, 0.42);
                halo.drawEllipse(0, 0, 27, 10);
                halo.lineStyle(2, 0x52dfff, 0.5);
                halo.drawEllipse(0, 0, 20, 7);

                const core = new PIXI.Graphics();
                core.beginFill(0x02020a, 1);
                core.drawCircle(0, 0, 13);
                core.endFill();

                hole.addChild(halo, core);
                hole.x = random(70, Math.max(71, window.innerWidth - 70));
                hole.y = random(90, Math.max(91, window.innerHeight - 90));
                hole.rotation = random(0, Math.PI);
                hole.pullRadius = 170;
                hole.pullStrength = 95;
                hole.phase = random(0, Math.PI * 2);

                this.blackHoles.push(hole);
                this.background.addChild(hole);
            }

            // Sterne.
            for (let index = 0; index < 105; index += 1) {
                const star = new PIXI.Graphics();

                star.beginFill(
                    index % 9 === 0 ? 0x9ce9ff : COLORS.white,
                    random(0.35, 1)
                );
                star.drawCircle(0, 0, random(0.7, 2.3));
                star.endFill();

                star.x = random(0, Math.max(1, window.innerWidth));
                star.y = random(0, Math.max(1, window.innerHeight));
                star.speed = random(16, 85);

                this.stars.push(star);
                this.background.addChild(star);
            }

            this.nextShootingStar = random(5, 11);
            this.drawBackgroundBounds();

            return this.background;
        }

        drawBackgroundBounds() {
            if (!this.backgroundFill || !this.app) return;

            this.backgroundFill.clear();
            this.backgroundFill.beginFill(COLORS.space);
            this.backgroundFill.drawRect(
                0,
                0,
                this.app.screen.width,
                this.app.screen.height
            );
            this.backgroundFill.endFill();
        }

        createShootingStar() {
            const star = new PIXI.Graphics();

            star.lineStyle(2, 0xbcefff, 0.9);
            star.moveTo(0, 0);
            star.lineTo(random(35, 75), -random(10, 24));
            star.beginFill(0xffffff, 1);
            star.drawCircle(0, 0, 2);
            star.endFill();

            star.x = random(20, this.app.screen.width);
            star.y = random(0, Math.max(40, this.app.screen.height * 0.55));
            star.vx = random(-300, -190);
            star.vy = random(140, 230);
            star.life = 1.2;

            this.background.addChild(star);
            this.shootingStars.push(star);
        }

        updateBackground(dt) {
            const speedFactor = this.state === GameState.PLAYING ? 1 : 0.18;

            for (const star of this.stars) {
                star.y += star.speed * dt * speedFactor;

                if (star.y > this.app.screen.height + 4) {
                    star.y = -4;
                    star.x = random(0, this.app.screen.width);
                }
            }

            for (const nebula of this.nebulae) {
                nebula.x += nebula.vx * dt;
                nebula.y += nebula.vy * dt;

                if (nebula.x < -220) nebula.x = this.app.screen.width + 180;
                if (nebula.x > this.app.screen.width + 220) nebula.x = -180;
            }

            for (const galaxy of this.galaxies) {
                galaxy.rotation += galaxy.spin * dt;
            }

            for (const hole of this.blackHoles) {
                hole.phase += dt;
                hole.rotation += dt * 0.16;
                hole.alpha = 0.82 + Math.sin(hole.phase * 2) * 0.12;
            }

            this.nextShootingStar -= dt * speedFactor;

            if (this.nextShootingStar <= 0) {
                this.createShootingStar();
                this.nextShootingStar = random(7, 15);
            }

            for (let i = this.shootingStars.length - 1; i >= 0; i -= 1) {
                const star = this.shootingStars[i];

                star.x += star.vx * dt;
                star.y += star.vy * dt;
                star.life -= dt;
                star.alpha = clamp(star.life / 1.2, 0, 1);

                if (
                    star.life <= 0 ||
                    star.x < -100 ||
                    star.y > this.app.screen.height + 80
                ) {
                    this.background.removeChild(star);
                    star.destroy();
                    this.shootingStars.splice(i, 1);
                }
            }
        }

        // ---------- HUD ----------

        createHud() {
            const style = {
                fontFamily: "Arial",
                fill: COLORS.white,
                fontWeight: "bold"
            };

            this.scoreLabel = new PIXI.Text("", { ...style, fontSize: 22 });
            this.scoreLabel.position.set(18, 14);

            this.levelLabel = new PIXI.Text("", {
                ...style,
                fontSize: 14,
                fill: COLORS.cyan
            });
            this.levelLabel.position.set(18, 42);

            this.shieldLabel = new PIXI.Text("", {
                ...style,
                fontSize: 16,
                fill: 0x48e5ff
            });
            this.shieldLabel.position.set(18, 66);

            this.energyLabel = new PIXI.Text("", {
                ...style,
                fontSize: 16,
                fill: 0xffd043
            });
            this.energyLabel.position.set(18, 90);

            this.rightLabel = new PIXI.Text("", {
                ...style,
                fontSize: 15,
                fill: COLORS.gold,
                align: "right"
            });
            this.rightLabel.anchor.set(1, 0);

            this.chargeLabel = new PIXI.Text("", {
                ...style,
                fontSize: 13,
                fill: COLORS.green
            });
            this.chargeLabel.position.set(18, 114);

            this.hud.addChild(
                this.scoreLabel,
                this.levelLabel,
                this.shieldLabel,
                this.energyLabel,
                this.rightLabel,
                this.chargeLabel
            );
        }

        updateHud() {
            const currentShields = Math.max(0, Math.min(this.maxShields, this.shields));
            const shieldBlocks =
                "▰".repeat(currentShields) +
                "▱".repeat(this.maxShields - currentShields);

            const currentEnergy = Math.max(0, Math.min(this.maxEnergy, this.energy));
            const energyBlocks =
                "▰".repeat(currentEnergy) +
                "▱".repeat(this.maxEnergy - currentEnergy);

            this.scoreLabel.text = `Punkte: ${this.score}`;
            this.levelLabel.text = `Runde ${this.runLevel} · Spieler-Level ${this.playerLevel}`;
            this.shieldLabel.text = `Schild:  ${shieldBlocks}`;
            this.energyLabel.text = `Energie: ${energyBlocks}`;
            this.rightLabel.text = `🪙 ${this.progress.coins}\n💥 ${this.shockwaves}`;
            this.rightLabel.x = this.app.screen.width - 18;

            this.chargeLabel.visible =
                this.progress.chargedUnlocked &&
                this.state === GameState.PLAYING;

            if (this.progress.chargedUnlocked) {
                const damage = clamp(Math.ceil(this.chargeTime), 1, 3);

                this.chargeLabel.text = this.isCharging
                    ? `Energieschuss lädt: ${"▰".repeat(damage)}${"▱".repeat(3 - damage)}`
                    : "Energieschuss bereit";
            }
        }

        // ---------- State transitions ----------

        handleCommand(command, value) {
            switch (command) {
                case "play":
                case "new":
                case "restart":
                    this.startNewRun();
                    break;case "resume":
                    this.resume();
                    break;
                case "menu":
                    this.showMenu();
                    break;
                case "shop":
                    this.state = GameState.MENU;
                    this.ui.showShop(this.getProgress());
                    break;
                case "upgrades":
                    this.state = GameState.MENU;
                    this.ui.showUpgradeMenu(this.getProgress());
                    break;
                case "settings":
                    this.state = GameState.MENU;
                    this.ui.showSettings();
                    break;
                case "buy":
                    this.buyChargedShot();
                    break;
                case "buy-upgrade":
                    this.buyUpgrade(value);
                    break;
                case "buy-double": this.buyShotUpgrade("double"); break;
                case "buy-triple": this.buyShotUpgrade("triple"); break;
                case "buy-skin": this.buySkin(value); break;
                case "upgrade-skin": this.upgradeSkin(value); break;
                case "equip-skin": this.equipSkin(value); break;
                default:
                    break;
            }
        }

        startNewRun() {
            this.resetRun();
            this.state = GameState.PLAYING;
            this.ui.hideOverlay();
            this.ui.notify("Neue Runde gestartet – viel Erfolg!");
        }

        resume() {
            if (this.state !== GameState.PAUSED) return;
            this.state = GameState.PLAYING;
            this.input.clear();
            this.ui.hideOverlay();
        }

        pause() {
            if (this.state !== GameState.PLAYING) return;
            this.state = GameState.PAUSED;
            this.input.clear();
            this.ui.showPause(this.getProgress());
        }

        showMenu() {
            this.state = GameState.MENU;
            this.input.clear();
            this.resetRun(false);
            this.ui.showMainMenu(this.getProgress());
        }

        endRun() {
            if (this.state !== GameState.PLAYING) return;
            this.state = GameState.GAME_OVER;
            this.input.clear();
            this.createExplosion(this.player.x, this.player.y, 1.5);
            this.destroyDisplayObject(this.player);
            this.player = null;
            if (this.score > this.progress.highscore) {
                this.progress.highscore = this.score;
                this.saveProgress();
                this.ui.notify("Neuer Rekord!");
            }
            this.ui.showGameOver(this.getProgress());
        }

        /** Remove all run-specific objects, including every transient effect. */
        resetRun(createPlayer = true) {
            this.clearCollection(this.enemies);
            this.clearCollection(this.asteroids);
            this.clearCollection(this.bullets);
            this.clearCollection(this.enemyBullets);
            this.clearCollection(this.coinsOnScreen);
            this.clearCollection(this.powerUps);
            this.clearCollection(this.effects);
            this.clearCollection(this.trails);
            this.destroyDisplayObject(this.player);
            this.player = createPlayer ? this.createPlayer() : null;
            this.score = 0;
            this.energy = this.maxEnergy;
            this.shields = this.maxShields;
            this.invulnerableTimer = 0;
            this.runLevel = 1;
            this.shockwaves = 0;
            this.chargeTime = 0;
            this.isCharging = false;
            this.fireCooldown = 0;
            this.energyRecharge = 0;
            this.trailCooldown = 0;
            this.resetSpawnTimers();
            this.updateHud();
        }

        takePlayerDamage(amount) {
            if (!this.player || this.invulnerableTimer > 0 || this.state !== GameState.PLAYING) return;

            this.shields = Math.max(0, this.shields - amount);
            this.invulnerableTimer = 1.2;
            this.createHitFlash(this.player.x, this.player.y);
            this.createExplosion(this.player.x, this.player.y, 0.45);

            if (this.shields <= 0) {
                this.endRun();
            } else {
                this.ui.notify(`Schild getroffen! Noch ${this.shields} Schild-Punkte.`);
            }
        }

        clearCollection(collection) {
            while (collection.length) this.destroyDisplayObject(collection.pop());
        }

        destroyDisplayObject(displayObject) {
            if (!displayObject) return;

            if (displayObject.glow) {
                if (displayObject.glow.parent) {
                    displayObject.glow.parent.removeChild(displayObject.glow);
                }

                displayObject.glow.destroy();
                displayObject.glow = null;
            }

            if (displayObject.parent) {
                displayObject.parent.removeChild(displayObject);
            }

            displayObject.destroy?.({ children: true });
        }

        buyChargedShot() {
            if (this.progress.chargedUnlocked || this.progress.coins < this.chargedPrice) return;
            this.progress.coins -= this.chargedPrice;
            this.progress.chargedUnlocked = true;
            this.saveProgress();
            this.ui.showShop(this.getProgress());
            this.ui.notify("Energieschuss freigeschaltet!");
        }

        buyShotUpgrade(kind) {
            const config = kind === "double" ? { key: "doubleShotUnlocked", price: 90, label: "Doppelschuss" }
                : { key: "tripleShotUnlocked", price: 150, label: "Dreifachschuss" };
            if (this.progress[config.key] || this.progress.coins < config.price) return;
            if (kind === "triple" && !this.progress.doubleShotUnlocked) {
                this.ui.notify("Schalte zuerst den Doppelschuss frei.");
                return;
            }
            this.progress.coins -= config.price;
            this.progress[config.key] = true;
            this.saveProgress();
            this.ui.showShop(this.getProgress());
            this.ui.notify(`${config.label} freigeschaltet!`);
        }

        buySkin(skinId) {
            const skin = this.getSkinOptions().find(item => item.id === skinId);
            if (!skin || skin.unlocked || this.progress.coins < skin.price || this.playerLevel < skin.level || !skin.previousMaxed) {
                this.ui.notify("Dafür musst du erst das vorherige Raketenskin voll upgraden und das nötige Level erreichen.");
                return;
            }
            this.progress.coins -= skin.price;
            this.progress.unlockedSkins.push(skin.id);
            this.progress.equippedSkin = skin.id;

            // Schiffs-Upgrades zurücksetzen, damit der Spieler sie für den neuen Skin neu kaufen kann:
            this.progress.upgrades.fireRate = 0;
            this.progress.upgrades.magnet = 0;
            this.progress.upgrades.movement = 0;

            this.saveProgress();
            this.ui.showShop(this.getProgress());
            this.applyRocketSkin();
            this.ui.notify(`${skin.name}-Skin freigeschaltet! Schiffs-Upgrades zurückgesetzt – baue deinen neuen Skin aus!`);
        }

        upgradeSkin(skinId) {
            if (!this.progress.unlockedSkins.includes(skinId)) return;
            const level = this.progress.skinLevels[skinId];
            if (level >= 5) return;
            const cost = 40 + level * 20;
            if (this.progress.coins < cost) {
                this.ui.notify(`Du brauchst noch ${cost - this.progress.coins} Münzen.`);
                return;
            }
            this.progress.coins -= cost;
            this.progress.skinLevels[skinId] += 1;
            this.saveProgress();
            this.ui.showShop(this.getProgress());
            this.ui.notify(`Raketenskin verbessert: Stufe ${level + 1}/5.`);
        }

        equipSkin(skinId) {
            if (!this.progress.unlockedSkins.includes(skinId)) return;
            this.progress.equippedSkin = skinId;
            this.saveProgress();
            this.applyRocketSkin();
            this.ui.showShop(this.getProgress());
            this.ui.notify("Raketenskin ausgerüstet!");
        }

        applyRocketSkin() {
            if (!this.player) return;
            const skin = this.getSkinOptions().find(item => item.id === this.progress.equippedSkin);
            this.player.tint = skin ? skin.tint : 0xffffff;
        }

        buyUpgrade(upgradeId) {
            if (!(upgradeId in this.progress.upgrades)) return;
            const currentLevel = this.progress.upgrades[upgradeId];
            const cost = this.getUpgradeCost(upgradeId);

            if (currentLevel >= this.maxUpgradeLevel) {
                this.ui.notify("Dieses Upgrade hat bereits die höchste Stufe.");
                return;
            }
            if (this.progress.coins < cost) {
                this.ui.notify(`Du brauchst noch ${cost - this.progress.coins} Münzen.`);
                return;
            }

            this.progress.coins -= cost;
            this.progress.upgrades[upgradeId] += 1;
            this.saveProgress();
            this.ui.showUpgradeMenu(this.getProgress());
            this.ui.notify("Upgrade gekauft!");
        }

        // ---------- Player, controls and weapons ----------

        createPlayer() {
            const rocket = PIXI.Sprite.from("assets/rocket.png");
            rocket.anchor.set(0.5);
            rocket.width = 48;
            rocket.height = 84;
            rocket.x = this.app.screen.width / 2;
            rocket.y = Math.max(100, this.app.screen.height - 110);
            rocket.vx = 0;
            rocket.vy = 0;
            this.world.addChild(rocket);
            const skin = this.getSkinOptions().find(item => item.id === this.progress.equippedSkin);
            rocket.tint = skin ? skin.tint : 0xffffff;
            return rocket;
        }

        updatePlayer(dt) {
            if (this.invulnerableTimer > 0) {
                this.invulnerableTimer -= dt;
                this.player.alpha = (Math.floor(this.invulnerableTimer * 16) % 2 === 0) ? 0.35 : 1.0;
                if (this.invulnerableTimer <= 0) {
                    this.player.alpha = 1.0;
                }
            }

            // Jede Antriebsstufe erhöht die aktuelle Geschwindigkeit um weitere 20 %.
            const movementMultiplier = 1.2 ** this.progress.upgrades.movement;
            const acceleration = 900 * movementMultiplier;
            const topSpeed = 350 * movementMultiplier;
            const friction = Math.pow(0.0008, dt);
            let inputX = 0;
            let inputY = 0;
            if (this.input.isDown("left")) inputX -= 1;
            if (this.input.isDown("right")) inputX += 1;
            if (this.input.isDown("up")) inputY -= 1;
            if (this.input.isDown("down")) inputY += 1;
            if (inputX && inputY) { inputX *= 0.707; inputY *= 0.707; }
            this.player.vx = clamp(this.player.vx + inputX * acceleration * dt, -topSpeed, topSpeed) * friction;
            this.player.vy = clamp(this.player.vy + inputY * acceleration * dt, -topSpeed, topSpeed) * friction;
            this.player.x += this.player.vx * dt;
            this.player.y += this.player.vy * dt;
            this.player.rotation += (this.player.vx * 0.0015 - this.player.rotation) * Math.min(1, 9 * dt);

            // Schwarze Löcher ziehen das Schiff leicht an – mit Gegensteuerung kann man entkommen.
            for (const hole of this.blackHoles) {
                const dx = hole.x - this.player.x;
                const dy = hole.y - this.player.y;
                const distance = Math.hypot(dx, dy);
                if (distance < hole.pullRadius && distance > 18) {
                    const force = hole.pullStrength * (1 - distance / hole.pullRadius);
                    this.player.vx += dx / distance * force * dt;
                    this.player.vy += dy / distance * force * dt;
                }
            }

            this.keepInBounds(this.player);

            this.trailCooldown -= dt;
            if (this.trailCooldown <= 0) {
                this.createTrail();
                this.trailCooldown = 0.035;
            }
        }

        keepInBounds(object) {
            const halfWidth = object.width / 2;
            const halfHeight = object.height / 2;
            object.x = clamp(object.x, halfWidth, this.app.screen.width - halfWidth);
            object.y = clamp(object.y, halfHeight, this.app.screen.height - halfHeight);
        }

        updateWeapons(dt) {
            this.fireCooldown = Math.max(0, this.fireCooldown - dt);
            this.energyRecharge += dt;
            if (this.energyRecharge >= 1.3 && this.energy < this.maxEnergy) {
                this.energy += 1;
                this.energyRecharge = 0;
            }

            if (!this.progress.chargedUnlocked) {
                if (this.input.consume("fire") || (this.input.isDown("fire") && this.fireCooldown === 0)) this.fireShot(1);
                return;
            }

            if (this.input.isDown("fire")) {
                this.isCharging = true;
                this.chargeTime = Math.min(3, this.chargeTime + dt);
            }
            if (this.input.consumeReleased("fire")) {
                const damage = clamp(Math.ceil(Math.max(0.1, this.chargeTime)), 1, 3);
                this.fireShot(damage);
                this.chargeTime = 0;
                this.isCharging = false;
            }
        }

        fireShot(damage) {
            if (!this.player || this.fireCooldown > 0) return;

            // Ein Energiepunkt pro Salve – auch bei Doppel- oder Dreifachschuss.
            if (this.energy < 1) {
                this.ui.notify("Nicht genug Energie – sie lädt automatisch nach.");
                return;
            }

            this.energy -= 1;
            this.fireCooldown = this.getFireCooldown(damage > 1 ? 0.32 : 0.18);

            const count = this.progress.tripleShotUnlocked ? 3 : this.progress.doubleShotUnlocked ? 2 : 1;
            const spacing = 17;

            for (let index = 0; index < count; index += 1) {
                const offset = (index - (count - 1) / 2) * spacing;
                const bullet = PIXI.Sprite.from("assets/bullet.png");
                bullet.anchor.set(0.5);
                bullet.width = 10 + damage * 4;
                bullet.height = 24 + damage * 7;
                bullet.tint = damage > 1 ? COLORS.green : (count > 1 ? 0x8beaff : COLORS.cyan);
                bullet.x = this.player.x + offset;
                bullet.y = this.player.y - this.player.height * 0.48;
                bullet.damage = damage;
                bullet.speed = 670;
                this.world.addChild(bullet);
                this.bullets.push(bullet);
            }
        }

        useShockwave() {
            if (this.shockwaves < 1 || !this.player) {
                this.ui.notify("Sammle zuerst ein 💥-Power-up.");
                return;
            }

            this.shockwaves -= 1;
            const wave = new PIXI.Graphics();
            wave.lineStyle(4, COLORS.cyan, 0.95);
            wave.drawCircle(0, 0, 5);
            wave.x = this.player.x;
            wave.y = this.player.y;
            wave.life = 0.48;
            wave.maxLife = wave.life;
            wave.radius = 220;
            wave.kind = "shockwave";
            this.fxLayer.addChild(wave);
            this.effects.push(wave);

            this.destroyInRadius(
                this.enemies,
                wave.x,
                wave.y,
                wave.radius,
                entity => this.destroyEnemy(entity)
            );

            // Vernichte feindliche Schüsse im Schockwellenradius
            for (let i = this.enemyBullets.length - 1; i >= 0; i -= 1) {
                const shot = this.enemyBullets[i];
                if (Math.hypot(shot.x - wave.x, shot.y - wave.y) <= wave.radius) {
                    this.createHitFlash(shot.x, shot.y);
                    this.removeFrom(this.enemyBullets, i);
                }
            }

            this.ui.notify("Schockwelle ausgelöst!");
        }

        destroyInRadius(collection, x, y, radius, destroy) {
            for (const entity of [...collection]) {
                if (Math.hypot(entity.x - x, entity.y - y) <= radius) {
                    destroy(entity);
                }
            }
        }

        // ---------- Spawning and game objects ----------

        resetSpawnTimers() {
            this.spawnTimers = {
                enemy: 0.8,
                asteroid: 2.8,
                powerUp: random(11, 16),
                meteor: random(32, 48),
                meteorActive: 0,
                meteorStream: 0
            };
        }

        updateSpawns(dt) {
            this.spawnTimers.enemy -= dt;
            this.spawnTimers.asteroid -= dt;
            this.spawnTimers.powerUp -= dt;
            this.spawnTimers.meteor -= dt;

            if (this.spawnTimers.meteorActive > 0) {
                this.spawnTimers.meteorActive -= dt;
                this.spawnTimers.meteorStream -= dt;
                if (this.spawnTimers.meteorStream <= 0) {
                    this.spawnAsteroid(true);
                    this.spawnTimers.meteorStream = 0.35;
                }
            } else if (this.spawnTimers.meteor <= 0) {
                this.spawnTimers.meteorActive = 4.0;
                this.spawnTimers.meteorStream = 0;
                this.spawnTimers.meteor = random(42, 65);
                this.ui.notify("☄ Meteoritenschauer!");
            }

            if (this.spawnTimers.enemy <= 0) {
                this.spawnEnemy();
                this.spawnTimers.enemy = Math.max(0.46, 1.22 - this.runLevel * 0.055);
            }

            if (this.spawnTimers.asteroid <= 0) {
                this.spawnAsteroid();
                this.spawnTimers.asteroid = Math.max(1.1, 3.1 - this.runLevel * 0.1);
            }

            if (this.spawnTimers.powerUp <= 0) {
                this.spawnPowerUp();
                this.spawnTimers.powerUp = random(12, 18);
            }
        }

        spawnEnemy() {
    const roll = Math.random();
    let ufoType = "classic";

    if (roll < 0.045) ufoType = "heavy";
    else if (roll < 0.16) ufoType = "fighter";
    else if (roll < 0.36) ufoType = "armored";
    else if (roll < 0.57) ufoType = "scout";
    else if (roll < 0.76) ufoType = "spectral";

    const heavy = ufoType === "heavy";
    const fighter = ufoType === "fighter";
    const armored = ufoType === "armored";

    const ufo = PIXI.Sprite.from(
        heavy || armored ? "assets/ufo2.png" : "assets/ufo1.png"
    );

    ufo.anchor.set(0.5);

    ufo.width = heavy ? 88 : armored ? 64 : fighter ? 66 : 52;
    ufo.height = heavy ? 54 : armored ? 34 : fighter ? 44 : 40;

    ufo.x = random(45, this.app.screen.width - 45);
    ufo.y = -55;

    ufo.speed = heavy
        ? random(75, 105)
        : fighter
            ? random(115, 150)
            : random(105, 160) + this.runLevel * 10;

    ufo.hp = heavy ? 5 : fighter ? 2 : armored ? 2 : 1;
    ufo.maxHp = ufo.hp;

    ufo.points = heavy ? 10 : fighter ? 5 : armored ? 3 : 1;
    ufo.coinValue = heavy ? 6 : fighter ? 3 : armored ? 2 : 1;

    ufo.phase = random(0, Math.PI * 2);
    ufo.armored = armored || heavy;
    ufo.ufoType = ufoType;

    ufo.tint = heavy ? 0xff4b9a
        : fighter ? 0xff5555
        : armored ? 0xffad42
        : ufoType === "scout" ? 0x7dffcf
        : ufoType === "spectral" ? 0xc49bff
        : 0xb5eaff;

    if (ufoType === "scout") {
        ufo.width *= 0.82;
        ufo.height *= 0.82;
        ufo.speed *= 1.18;
    }

    if (ufoType === "spectral") {
        ufo.width *= 1.08;
        ufo.alpha = 0.82;
        ufo.speed *= 0.9;
    }

    ufo.trailCooldown = random(0.04, 0.1);

    if (fighter) {
        ufo.shootCooldown = random(1.2, 2.2);
    }

    const glow = new PIXI.Graphics();

    const glowColor = heavy ? 0xff2388
        : fighter ? 0xff3322
        : armored ? 0xff351e
        : 0x168cff;

    glow.beginFill(glowColor, heavy ? 0.30 : 0.20);
    glow.drawEllipse(0, 0, ufo.width * 0.85, ufo.height * 0.9);
    glow.endFill();

    glow.x = ufo.x;
    glow.y = ufo.y;

    this.world.addChild(glow);
ufo.glow = glow;

// Lebensbalken über dem UFO
ufo.healthBar = new PIXI.Graphics();
ufo.addChild(ufo.healthBar);

this.drawEnemyHealthBar(ufo);

this.world.addChild(ufo);
this.enemies.push(ufo);
}
        drawEnemyHealthBar(enemy) {
    if (!enemy.healthBar) return;

    const bar = enemy.healthBar;

    const barWidth = Math.max(30, Math.min(54, enemy.width * 0.8));
    const barHeight = 6;

    const x = -barWidth / 2;
    const y = -enemy.height / 2 - 12;

    const healthPercent = clamp(enemy.hp / enemy.maxHp, 0, 1);

    // Farbe abhängig von den verbleibenden Lebenspunkten
    const color = healthPercent > 0.6
        ? 0x00ff88
        : healthPercent > 0.3
            ? 0xffcc33
            : 0xff3344;

    bar.clear();

    // Dunkler Hintergrund
    bar.beginFill(0x101827, 0.9);
    bar.lineStyle(1, 0xffffff, 0.65);
    bar.drawRoundedRect(x, y, barWidth, barHeight, 3);
    bar.endFill();

    // Gefüllter Lebensbalken
    if (healthPercent > 0) {
        bar.beginFill(color, 1);
        bar.drawRoundedRect(
            x + 1,
            y + 1,
            (barWidth - 2) * healthPercent,
            barHeight - 2,
            2
        );
        bar.endFill();
    }
}

        spawnAsteroid(isMeteor = false) {
            const fire = isMeteor || Math.random() < Math.min(0.38, 0.18 + this.runLevel * 0.02);
            const asteroid = new PIXI.Graphics();
            const radius = fire ? random(21, 31) : random(13, 23);
            asteroid.beginFill(fire ? 0x842615 : 0x747786);
            asteroid.lineStyle(fire ? 3 : 2, fire ? 0xff7a26 : 0xc5c8d4, 0.95);
            const points = [];

            for (let index = 0; index < 9; index += 1) {
                const angle = index / 9 * Math.PI * 2;
                const distance = radius * random(0.68, 1);
                points.push(Math.cos(angle) * distance, Math.sin(angle) * distance);
            }

            asteroid.drawPolygon(points);
            asteroid.endFill();
            asteroid.x = random(radius, this.app.screen.width - radius);
            asteroid.y = -radius * 2;
            asteroid.radius = radius;
            asteroid.speed = isMeteor ? random(230, 330) : random(95, 145) + this.runLevel * 8 + (fire ? 80 : 0);
            asteroid.vx = random(-56, 56);
            asteroid.spin = random(-2.2, 2.2);
            asteroid.decorative = true;
            asteroid.fire = fire;

            // Leuchtender Schein für den Asteroiden
            const glow = new PIXI.Graphics();
            glow.lineStyle(
                fire ? 9 : 7,
                fire ? 0xff321e : 0x268cff,
                fire ? 0.35 : 0.28
            );
            glow.drawPolygon(points);
            glow.x = asteroid.x;
            glow.y = asteroid.y;

            this.asteroidLayer.addChild(glow);
            asteroid.glow = glow;
            asteroid.trailCooldown = 0;
            asteroid.points = 0;
            asteroid.coinValue = 0;

            this.asteroidLayer.addChild(asteroid);
            this.asteroids.push(asteroid);
        }

        spawnPowerUp() {
            const type = Math.random() < 0.52 ? "rapid" : "shockwave";
            const powerUp = new PIXI.Container();
            const box = new PIXI.Graphics();
            const color = type === "rapid" ? COLORS.green : COLORS.blue;

            box.beginFill(color, 0.9);
            box.lineStyle(2, COLORS.white, 0.9);
            box.drawRoundedRect(-19, -19, 38, 38, 9);
            box.endFill();

            const icon = new PIXI.Text(type === "rapid" ? "⚡" : "💥", {
                fontSize: 23
            });
            icon.anchor.set(0.5);

            powerUp.addChild(box, icon);
            powerUp.x = random(36, this.app.screen.width - 36);
            powerUp.y = -36;
            powerUp.speed = 100;
            powerUp.type = type;

            this.world.addChild(powerUp);
            this.powerUps.push(powerUp);
        }

        createCoin(x, y, value) {
            const coin = new PIXI.Text("🪙", { fontSize: 25 });
            coin.anchor.set(0.5);
            coin.x = x;
            coin.y = y;
            coin.vx = random(-70, 70);
            coin.vy = random(-50, 20);
            coin.value = value;
            coin.life = 5;

            this.world.addChild(coin);
            this.coinsOnScreen.push(coin);
        }

        // ---------- Object updates and collisions ----------

        update(dt) {
            this.updateBackground(dt);

            if (this.input.consume("pause")) {
                if (this.state === GameState.PLAYING) {
                    this.pause();
                    this.input.endFrame();
                    return;
                } else if (this.state === GameState.PAUSED) {
                    this.resume();
                    this.input.endFrame();
                    return;
                }
            }

            if (this.state !== GameState.PLAYING) {
                this.updateVisualEffects(dt);
                this.input.endFrame();
                return;
            }

            if (this.input.consume("shockwave")) this.useShockwave();

            this.updatePlayer(dt);
            this.updateWeapons(dt);
            this.updateSpawns(dt);
            this.updateBullets(dt);
            this.updateEnemies(dt);
            this.updateEnemyBullets(dt);
            this.updateAsteroids(dt);
            this.updatePowerUps(dt);
            this.updateCoins(dt);
            this.updateVisualEffects(dt);

            this.runLevel = 1 + Math.floor(this.score / 10);
            this.updateHud();
            this.input.endFrame();
        }

        updateBullets(dt) {
            for (let index = this.bullets.length - 1; index >= 0; index -= 1) {
                const bullet = this.bullets[index];
                bullet.y -= bullet.speed * dt;

                if (bullet.y < -40) {
                    this.removeFrom(this.bullets, index);
                    continue;
                }

                let hit = false;

                for (const enemy of [...this.enemies]) {
                    if (!overlaps(bullet, enemy)) continue;

                    enemy.hp -= bullet.damage;
                    this.drawEnemyHealthBar(enemy);

                    if (enemy.hp <= 0) {
                        this.destroyEnemy(enemy);
                    } else {
                        this.createHitFlash(enemy.x, enemy.y);
                    }

                    hit = true;
                    break;
                }

                if (hit && this.bullets.includes(bullet)) {
                    this.removeEntity(this.bullets, bullet);
                }
            }
        }

        updateEnemies(dt) {
            for (let index = this.enemies.length - 1; index >= 0; index -= 1) {
                const enemy = this.enemies[index];

                enemy.phase += dt * 3.2;
                enemy.y += enemy.speed * dt;
                enemy.x += Math.sin(enemy.phase) * 44 * dt;

                if (enemy.glow) {
                    enemy.glow.x = enemy.x;
                    enemy.glow.y = enemy.y;
                    enemy.glow.alpha = 0.15 + Math.sin(enemy.phase * 2) * 0.06;
                }

                enemy.trailCooldown -= dt;

                if (enemy.trailCooldown <= 0) {
                    this.createUfoNebulaTrail(enemy);
                    enemy.trailCooldown = random(0.045, 0.085);
                }

if (enemy.ufoType === "fighter" && this.player) {
    enemy.shootCooldown -= dt;

    if (enemy.shootCooldown <= 0) {
        this.fireEnemyShot(enemy);
        enemy.shootCooldown = random(3.0, 4.0);
    }
}

                if (enemy.y > this.app.screen.height + 60) {
                    this.removeFrom(this.enemies, index);
                    continue;
                }

                if (this.player && this.invulnerableTimer <= 0 && overlaps(enemy, this.player)) {
                    this.takePlayerDamage(this.shields);
                }
            }
        }
fireEnemyShot(enemy) {
    if (!this.player || !enemy) return;

    const shot = new PIXI.Graphics();

    shot.beginFill(0xff3d55, 0.98);
    shot.lineStyle(2, 0xffb2bd, 0.95);
    shot.drawCircle(0, 0, 7);
    shot.endFill();

    shot.x = enemy.x;
    shot.y = enemy.y + enemy.height * 0.45;

    const dx = this.player.x - shot.x;
    const dy = this.player.y - shot.y;

    const length = Math.max(1, Math.hypot(dx, dy));

    shot.vx = (dx / length) * 155;
    shot.vy = (dy / length) * 155;

    this.world.addChild(shot);
    this.enemyBullets.push(shot);
}
updateEnemyBullets(dt) {
    for (let index = this.enemyBullets.length - 1; index >= 0; index--) {
        const shot = this.enemyBullets[index];

        shot.x += shot.vx * dt;
        shot.y += shot.vy * dt;

        if (
            shot.x < -20 ||
            shot.x > this.app.screen.width + 20 ||
            shot.y < -20 ||
            shot.y > this.app.screen.height + 20
        ) {
            this.removeFrom(this.enemyBullets, index);
            continue;
        }

        if (this.player && this.invulnerableTimer <= 0) {
            const hitDistance = Math.hypot(
                this.player.x - shot.x,
                this.player.y - shot.y
            );

            if (hitDistance < Math.min(this.player.width, this.player.height) * 0.42 + 7) {
                this.removeFrom(this.enemyBullets, index);
                this.takePlayerDamage(1);
                continue;
            }
        }
    }
}   

        updateAsteroids(dt) {
            for (let index = this.asteroids.length - 1; index >= 0; index -= 1) {
                const asteroid = this.asteroids[index];

                asteroid.x += asteroid.vx * dt;
                asteroid.y += asteroid.speed * dt;
                asteroid.rotation += asteroid.spin * dt;

                // Glow folgt dem Asteroiden.
                if (asteroid.glow) {
                    asteroid.glow.x = asteroid.x;
                    asteroid.glow.y = asteroid.y;
                    asteroid.glow.rotation = asteroid.rotation;
                }

                // Feuerschweif für Feuer-Asteroiden.
                if (asteroid.fire) {
                    asteroid.trailCooldown -= dt;

                    if (asteroid.trailCooldown <= 0) {
                        this.createAsteroidTrail(asteroid);
                        asteroid.trailCooldown = 0.035;
                    }
                }

                // Asteroiden verursachen Schaden bei Berührung.
if (
    this.player &&
    this.invulnerableTimer <= 0 &&
    overlaps(asteroid, this.player)
) {
    if (asteroid.fire) {
        // Große rote Feuer-Asteroiden verursachen sofort Game Over.
        this.takePlayerDamage(this.shields);
    } else {
        // Normale graue Asteroiden ziehen einen Schildpunkt ab.
        this.takePlayerDamage(1);
    }

    this.createHitFlash(asteroid.x, asteroid.y);
}

                if (asteroid.x < -asteroid.radius) {
                    asteroid.x = this.app.screen.width + asteroid.radius;
                }

                if (asteroid.x > this.app.screen.width + asteroid.radius) {
                    asteroid.x = -asteroid.radius;
                }

                if (asteroid.y > this.app.screen.height + asteroid.radius * 2) {
                    this.removeFrom(this.asteroids, index);
                }
            }
        }

        updatePowerUps(dt) {
            for (let index = this.powerUps.length - 1; index >= 0; index -= 1) {
                const powerUp = this.powerUps[index];

                powerUp.y += powerUp.speed * dt;
                powerUp.rotation += dt * 1.5;

                if (powerUp.y > this.app.screen.height + 45) {
                    this.removeFrom(this.powerUps, index);
                    continue;
                }

                if (this.player && overlaps(powerUp, this.player)) {
                    if (powerUp.type === "rapid") {
                        this.energy = this.maxEnergy;
                        this.shields = Math.min(this.maxShields, this.shields + 1);
                        this.ui.notify("Energie & Schild aufgeladen!");
                    } else {
                        this.shockwaves = Math.min(3, this.shockwaves + 1);
                        this.ui.notify("Schockwelle bereit – Q oder 💥 drücken.");
                    }

                    this.createExplosion(powerUp.x, powerUp.y, 0.6);
                    this.removeFrom(this.powerUps, index);
                }
            }
        }

        updateCoins(dt) {
            for (let index = this.coinsOnScreen.length - 1; index >= 0; index -= 1) {
                const coin = this.coinsOnScreen[index];

                coin.life -= dt;
                coin.vy += 110 * dt;
                coin.vx *= Math.pow(0.22, dt);
                coin.x += coin.vx * dt;
                coin.y += coin.vy * dt;
                coin.rotation += dt * 6;

                if (this.player) {
                    const distance = Math.hypot(
                        this.player.x - coin.x,
                        this.player.y - coin.y
                    );
                    const magnetRange = this.getMagnetRange();

                    if (distance < magnetRange) {
                        const pull = 500 * (1 - distance / magnetRange);
                        coin.vx += (this.player.x - coin.x) / Math.max(distance, 1) * pull * dt;
                        coin.vy += (this.player.y - coin.y) / Math.max(distance, 1) * pull * dt;
                    }
                }

                if (this.player && overlaps(coin, this.player)) {
                    this.progress.coins += coin.value;
                    this.scheduleSave();
                    this.createCoinText(coin.x, coin.y, coin.value);
                    this.removeFrom(this.coinsOnScreen, index);
                    continue;
                }

                if (coin.life <= 0 || coin.y > this.app.screen.height + 45) {
                    this.removeFrom(this.coinsOnScreen, index);
                }
            }
        }

        destroyEnemy(enemy) {
            const position = { x: enemy.x, y: enemy.y };

            this.removeEntity(this.enemies, enemy);
            this.score += enemy.points;
            this.addXP(1);
            this.createExplosion(
                position.x,
                position.y,
                enemy.armored ? 1.15 : 0.85
            );
            this.createCoin(position.x, position.y, enemy.coinValue);
        }

        addXP(amount) {
            const oldLevel = this.playerLevel;
            this.progress.totalXP += amount;
            this.scheduleSave();

            if (this.playerLevel > oldLevel) {
                this.ui.notify(`Spieler-Level ${this.playerLevel} erreicht!`);
            }
        }

        removeFrom(collection, index) {
            const [entity] = collection.splice(index, 1);
            this.destroyDisplayObject(entity);
        }

        removeEntity(collection, entity) {
            const index = collection.indexOf(entity);
            if (index >= 0) this.removeFrom(collection, index);
        }

        // ---------- Visual effects ----------

        createUfoNebulaTrail(enemy) {
            const puff = new PIXI.Graphics();
            const color = enemy.armored
                ? 0xffa34a
                : enemy.ufoType === "spectral"
                    ? 0xb58cff
                    : 0x59dfff;

            puff.beginFill(color, 0.25);
            puff.drawCircle(0, 0, random(4, 8));
            puff.endFill();

            puff.x = enemy.x + random(-enemy.width * 0.25, enemy.width * 0.25);
            puff.y = enemy.y + enemy.height * 0.35;
            puff.vx = random(-12, 12);
            puff.vy = random(22, 48);
            puff.life = 0.45;
            puff.maxLife = puff.life;
            puff.kind = "particle";

            this.fxLayer.addChild(puff);
            this.effects.push(puff);
        }

        createAsteroidTrail(asteroid) {
            const particle = new PIXI.Graphics();

            particle.beginFill(
                Math.random() > 0.5 ? 0xff2600 : 0xff9a21,
                0.9
            );
            particle.drawCircle(0, 0, random(3, 7));
            particle.endFill();

            particle.x = asteroid.x + random(-5, 5);
            particle.y = asteroid.y - asteroid.radius * 0.5;
            particle.vx = random(-25, 25);
            particle.vy = random(-100, -45);
            particle.life = 0.35;
            particle.maxLife = particle.life;
            particle.kind = "particle";

            this.asteroidLayer.addChild(particle);
            this.effects.push(particle);
        }

        createTrail() {
            if (!this.player) return;

            const particle = new PIXI.Graphics();
            particle.beginFill(
                Math.random() > 0.5 ? 0xff9a1f : COLORS.cyan,
                0.82
            );
            particle.drawCircle(0, 0, random(2, 4));
            particle.endFill();

            particle.x = this.player.x;
            particle.y = this.player.y + this.player.height * 0.42;
            particle.vx = random(-24, 24);
            particle.vy = random(80, 145);
            particle.life = 0.42;
            particle.maxLife = particle.life;
            particle.kind = "particle";

            this.fxLayer.addChild(particle);
            this.trails.push(particle);
        }

        createHitFlash(x, y) {
            const flash = new PIXI.Graphics();
            flash.beginFill(COLORS.white, 0.95);
            flash.drawCircle(0, 0, 8);
            flash.endFill();

            flash.x = x;
            flash.y = y;
            flash.life = 0.14;
            flash.maxLife = flash.life;
            flash.kind = "flash";

            this.fxLayer.addChild(flash);
            this.effects.push(flash);
        }

        createExplosion(x, y, power) {
            const explosion = new PIXI.Container();
            explosion.x = x;
            explosion.y = y;
            explosion.life = 0.45;
            explosion.maxLife = explosion.life;
            explosion.kind = "explosion";

            for (let index = 0; index < Math.round(12 * power); index += 1) {
                const particle = new PIXI.Graphics();

                particle.beginFill(
                    [0xff5b29, 0xffb321, COLORS.gold, COLORS.cyan][index % 4]
                );
                particle.drawCircle(0, 0, random(2, 4.5) * power);
                particle.endFill();

                const angle = random(0, Math.PI * 2);
                const speed = random(75, 250) * power;

                particle.vx = Math.cos(angle) * speed;
                particle.vy = Math.sin(angle) * speed;

                explosion.addChild(particle);
            }

            this.fxLayer.addChild(explosion);
            this.effects.push(explosion);
        }

        createCoinText(x, y, value) {
            const text = new PIXI.Text(`+${value} 🪙`, {
                fontFamily: "Arial",
                fontSize: 18,
                fontWeight: "bold",
                fill: COLORS.gold
            });

            text.anchor.set(0.5);
            text.x = x;
            text.y = y;
            text.life = 0.75;
            text.maxLife = text.life;
            text.kind = "text";

            this.fxLayer.addChild(text);
            this.effects.push(text);
        }

        updateVisualEffects(dt) {
            this.updateEffectCollection(this.trails, dt);
            this.updateEffectCollection(this.effects, dt);
        }

        updateEffectCollection(collection, dt) {
            for (let index = collection.length - 1; index >= 0; index -= 1) {
                const effect = collection[index];
                effect.life -= dt;

                const progress = clamp(
                    1 - effect.life / effect.maxLife,
                    0,
                    1
                );

                if (effect.kind === "particle") {
                    effect.x += effect.vx * dt;
                    effect.y += effect.vy * dt;
                    effect.scale.set(1 - progress * 0.65);
                } else if (effect.kind === "flash") {
                    effect.scale.set(1 + progress * 2);
                } else if (effect.kind === "explosion") {
                    for (const particle of effect.children) {
                        particle.x += particle.vx * dt;
                        particle.y += particle.vy * dt;
                        particle.vx *= Math.pow(0.045, dt);
                        particle.vy *= Math.pow(0.045, dt);
                    }
                } else if (effect.kind === "shockwave") {
                    const scale = 1 + progress * effect.radius / 5;
                    effect.scale.set(scale);
                } else if (effect.kind === "text") {
                    effect.y -= 32 * dt;
                }

                effect.alpha = 1 - progress;

                if (effect.life <= 0) {
                    this.removeFrom(collection, index);
                }
            }
        }
    }

    window.addEventListener("DOMContentLoaded", () => {
        window.pixelWolfGame = new PixelWolfGame();
    });
})();
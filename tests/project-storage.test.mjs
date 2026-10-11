// No browser, paid provider calls, or extra test dependency needed: node --test tests/project-storage.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { setImmediate as nextTurn } from "node:timers/promises";
import { test } from "node:test";

class MemoryStorage {
	getItem(key) { return Object.hasOwn(this, key) ? this[key] : null; }
	setItem(key, value) { this[key] = String(value); }
	removeItem(key) { delete this[key]; }
}

function mockIndexedDB() {
	const state = { records: new Map(), opens: 0, writes: 0, failNextWrite: false, failNextRead: false, holdNextWrite: false, release: null };
	let created = false;
	const db = {
		objectStoreNames: { contains: () => created },
		createObjectStore: () => { created = true; },
		close() {},
		transaction(_stores, mode) {
			const writing = mode === "readwrite";
			if (writing) state.writes++;
			const shouldFail = writing && state.failNextWrite;
			const shouldHold = writing && state.holdNextWrite;
			if (writing) { state.failNextWrite = false; state.holdNextWrite = false; }
			const records = writing ? new Map(state.records) : state.records;
			let pending = 0;
			let finished = false;
			let finishScheduled = false;
			const transaction = {
				error: null,
				abort() {
					if (finished) return;
					finished = true;
					transaction.error = new Error("Mock transaction aborted after request success");
					transaction.onabort?.();
				},
				objectStore() { return store; },
			};
			const finish = () => {
				if (finished || pending) return;
				const commit = () => {
					if (shouldFail) return transaction.abort();
					finished = true;
					if (writing) state.records = records;
					transaction.oncomplete?.();
				};
				if (shouldHold) state.release = commit;
				else commit();
			};
			const maybeFinish = () => {
				if (finishScheduled || finished) return;
				finishScheduled = true;
				setImmediate(() => { finishScheduled = false; finish(); });
			};
			const requestFor = (operation) => {
				pending++;
				const request = { result: undefined };
				setImmediate(() => {
					if (finished) return;
					try {
						request.result = operation();
						pending--;
						request.onsuccess?.({ target: request });
						maybeFinish();
					} catch (error) {
						pending--;
						request.error = error;
						request.onerror?.({ target: request });
						transaction.abort();
					}
				});
				return request;
			};
			const store = {
				put(record) { return requestFor(() => { records.set(record.id, structuredClone(record)); return record.id; }); },
				get(id) {
					return requestFor(() => {
						if (state.failNextRead) {
							state.failNextRead = false;
							throw new Error("Mock IndexedDB read failure");
						}
						return records.get(id);
					});
				},
				clear() { return requestFor(() => records.clear()); },
				openCursor() {
					const entries = [...records.entries()];
					const request = { result: undefined };
					let index = 0;
					const advance = () => {
						pending++;
						setImmediate(() => {
							if (finished) return;
							const entry = entries[index++];
							request.result = entry ? {
								value: entry[1],
								delete: () => requestFor(() => records.delete(entry[0])),
								continue: advance,
							} : null;
							pending--;
							request.onsuccess?.({ target: request });
							maybeFinish();
						});
					};
					advance();
					return request;
				},
			};
			maybeFinish();
			return transaction;
		},
	};
	return {
		state,
		open() {
			state.opens++;
			const request = { result: db };
			setImmediate(() => {
				if (!created) request.onupgradeneeded?.({ target: request });
				request.onsuccess?.();
			});
			return request;
		},
	};
}

function mockLocks() {
	const queues = new Map();
	return {
		request(name, options, callback) {
			assert.equal(options.mode, "exclusive");
			const previous = queues.get(name) || Promise.resolve();
			const result = previous.then(() => callback({ name, mode: "exclusive" }));
			queues.set(name, result.then(() => undefined, () => undefined));
			return result;
		},
	};
}

let fixtureId = 0;
async function importStorageModule() {
	const source = readFileSync(new URL("../src/lib/projectStorage.ts", import.meta.url), "utf8");
	const projectTypes = stripTypeScriptTypes(readFileSync(new URL("../src/types/project.ts", import.meta.url), "utf8"));
	const typeURL = `data:text/javascript;base64,${Buffer.from(projectTypes).toString("base64")}`;
	const compiled = stripTypeScriptTypes(source).replace('from "@/types/project"', `from "${typeURL}"`);
	return import(`data:text/javascript;base64,${Buffer.from(`${compiled}\n// fixture ${fixtureId++}`).toString("base64")}`);
}

async function fixture({ withLocks = true } = {}) {
	globalThis.localStorage = new MemoryStorage();
	const idb = mockIndexedDB();
	globalThis.indexedDB = idb;
	Object.defineProperty(globalThis, "navigator", {
		value: withLocks ? { locks: mockLocks() } : {}, configurable: true,
	});
	const storage = await importStorageModule();
	return { storage, idb, local: globalThis.localStorage };
}

function save(storage, id, story = "A story", panels = [], options) {
	return storage.saveProjectData(id, story, "manga", null, null, [], panels, [], [], undefined, undefined, options);
}

const customSize = { width: 1024, height: 1024, aspectRatio: "1:1", volcEngineSize: "1K" };

test("a newly created blank project immediately reloads without opening IndexedDB", async () => {
	const { storage, idb } = await fixture();
	const metadata = storage.createProject({ name: "Blank", style: "comic", imageSize: customSize });
	const project = await storage.loadProjectData(metadata.id);
	assert.equal(project.story, "");
	assert.equal(project.style, "comic");
	assert.deepEqual(project.imageSize, customSize);
	assert.deepEqual(project.generatedPanels, []);
	assert.equal(storage.getCurrentProjectId(), metadata.id);
	assert.equal(idb.state.opens, 0);
});

test("metadata-only projects from the old creator remain loadable", async () => {
	const { storage, local } = await fixture();
	const metadata = storage.createProject({ name: "Legacy blank" });
	local.removeItem(`manga-project-${metadata.id}`);
	assert.equal((await storage.loadProjectData(metadata.id)).story, "");
	assert.equal(await storage.loadProjectData("does-not-exist"), null);
});

test("images, URLs, workflow settings, uploads and panel versions round-trip", async () => {
	const { storage, local } = await fixture();
	const { id } = storage.createProject({ name: "Round trip" });
	const studio = { aiModel: "auto", step: 4, approved: true, comicLayout: "japanese", requestedPanelCount: 6, plannedStory: "Hello", stalePanels: [2], panelVersions: { "1": [{ panelNumber: 1, image: "data:image/png;base64,old", composition: "japanese" }] } };
	const chars = [{ name: "Mina", description: "Lead", image: "https://images.example/character.png" }];
	const panels = [{ panelNumber: 1, image: "https://images.example/panel.png", composition: "japanese" }];
	const uploaded = [{ id: "upload1", name: "Mina", fileName: "mina.png", image: "data:image/png;base64,upload" }];
	const generationState = { isGenerating: false, isPaused: true, currentPanel: 1, totalPanels: 6, completedPanels: 1, failedPanels: [2] };
	await storage.saveProjectData(id, "Hello", "comic", null, null, chars, panels, uploaded, uploaded, customSize, generationState, { studio });
	const restored = await storage.loadProjectData(id);
	assert.deepEqual(restored.characterReferences, chars);
	assert.deepEqual(restored.generatedPanels, panels);
	assert.deepEqual(restored.uploadedCharacterReferences, uploaded);
	assert.deepEqual(restored.uploadedSettingReferences, uploaded);
	assert.deepEqual(restored.studio, studio);
	assert.deepEqual(restored.generationState, generationState);
	assert.deepEqual(restored.imageSize, customSize);
	assert.deepEqual(restored.metadata.imageSize, customSize);
	assert.equal(restored.metadata.panelCount, 1);
	assert.equal(restored.metadata.characterCount, 1);
	assert.equal(local.getItem(`manga-project-${id}`).includes("data:image"), false, "version images belong in IndexedDB");
	await save(storage, id, "Edited", panels);
	assert.deepEqual((await storage.loadProjectData(id)).studio, studio, "old call signatures preserve studio settings");
});

test("save waits for the image transaction commit before publishing text", async () => {
	const { storage, idb, local } = await fixture();
	const { id } = storage.createProject({ name: "Commit" });
	idb.state.holdNextWrite = true;
	let resolved = false;
	const saving = save(storage, id, "New", [{ panelNumber: 1, image: "image" }]).then(() => { resolved = true; });
	while (!idb.state.release) await nextTurn();
	assert.equal(resolved, false);
	assert.equal(JSON.parse(local.getItem(`manga-project-${id}`)).story, "");
	idb.state.release();
	await saving;
	assert.equal((await storage.loadProjectData(id)).story, "New");
});

test("aborted writes preserve the last committed project and allow a later save", async () => {
	const { storage, idb } = await fixture();
	const { id } = storage.createProject({ name: "Abort" });
	await save(storage, id, "Original", [{ panelNumber: 1, image: "old-image" }]);
	idb.state.failNextWrite = true;
	await assert.rejects(save(storage, id, "Failed", [{ panelNumber: 1, image: "new-image" }]), /aborted/);
	assert.equal((await storage.loadProjectData(id)).story, "Original");
	assert.equal((await storage.loadProjectData(id)).generatedPanels[0].image, "old-image");
	await save(storage, id, "Retry", [{ panelNumber: 1, image: "retry-image" }]);
	assert.equal((await storage.loadProjectData(id)).story, "Retry");
});

test("overlapping saves run in order and snapshot mutable arguments", async () => {
	const { storage, idb } = await fixture();
	const { id } = storage.createProject({ name: "Overlap" });
	idb.state.holdNextWrite = true;
	const first = save(storage, id, "First", [{ panelNumber: 1, image: "first" }]);
	while (!idb.state.release) await nextTurn();
	const panels = [{ panelNumber: 1, image: "second" }];
	const second = save(storage, id, "Second", panels);
	panels[0].image = "mutated-after-call";
	const loading = storage.loadProjectData(id);
	idb.state.release();
	await Promise.all([first, second]);
	const restored = await loading;
	assert.equal(restored.story, "Second");
	assert.equal(restored.generatedPanels[0].image, "second");
	assert.equal(idb.state.records.size, 1, "superseded revisions are collected");
});

test("legacy image keys and missing images retain editable records", async () => {
	const { storage, idb, local } = await fixture();
	const { id } = storage.createProject({ name: "Legacy images" });
	const data = JSON.parse(local.getItem(`manga-project-${id}`));
	data.characterReferences = [{ name: "Missing", description: "Do not discard me" }];
	data.generatedPanels = [{ panelNumber: 1 }];
	delete data.uploadedCharacterReferences;
	delete data.uploadedSettingReferences;
	local.setItem(`manga-project-${id}`, JSON.stringify(data));
	idb.state.records.set(`${id}-panel-1`, { id: `${id}-panel-1`, projectId: id, imageId: "panel-1", imageData: "https://images.example/legacy.png" });
	const restored = await storage.loadProjectData(id);
	assert.deepEqual(restored.characterReferences, [{ name: "Missing", description: "Do not discard me", image: "" }]);
	assert.equal(restored.generatedPanels[0].image, "https://images.example/legacy.png");
	assert.deepEqual(restored.uploadedCharacterReferences, []);
});

test("deletion queues behind saves and cannot resurrect a project", async () => {
	const { storage, idb, local } = await fixture();
	const { id } = storage.createProject({ name: "Delete" });
	const saving = save(storage, id, "Pending", [{ panelNumber: 1, image: "image" }]);
	const deleting = storage.deleteProject(id);
	await Promise.all([saving, deleting]);
	assert.equal(await storage.loadProjectData(id), null);
	assert.equal(local.getItem(`manga-project-${id}`), null);
	assert.equal(storage.getCurrentProjectId(), null);
	assert.equal(idb.state.records.size, 0);
	await assert.rejects(save(storage, id), /not found/);
});

test("clearing panels removes the old thumbnail and stale image records", async () => {
	const { storage, idb } = await fixture();
	const { id } = storage.createProject({ name: "Reset" });
	await save(storage, id, "Story", [{ panelNumber: 1, image: "image" }]);
	await save(storage, id, "Story", []);
	assert.equal((await storage.loadProjectData(id)).metadata.thumbnail, undefined);
	assert.equal(idb.state.records.size, 0);
	await storage.clearAllProjects();
	assert.deepEqual(storage.getProjectList(), []);
	assert.equal(await storage.loadProjectData(id), null);
});

test("a metadata write failure rolls the project document back without replacing its images", async () => {
	const { storage, local } = await fixture();
	const { id } = storage.createProject({ name: "Quota" });
	await save(storage, id, "Original", [{ panelNumber: 1, image: "https://images.example/old.png" }]);
	const setItem = local.setItem.bind(local);
	let fail = true;
	local.setItem = (key, value) => {
		if (key === "manga-projects-list" && fail) {
			fail = false;
			throw new Error("Quota exceeded");
		}
		setItem(key, value);
	};
	await assert.rejects(save(storage, id, "New", [{ panelNumber: 1, image: "https://images.example/new.png" }], {
		metadata: { name: "Should not persist", description: "Neither should this" },
	}), /Quota/);
	const restored = await storage.loadProjectData(id);
	assert.equal(restored.story, "Original");
	assert.equal(restored.generatedPanels[0].image, "https://images.example/old.png");
	assert.equal(restored.metadata.thumbnail, "https://images.example/old.png");
	assert.equal(restored.metadata.name, "Quota");
	assert.equal(restored.metadata.description, undefined);
});

test("failed creation does not leave an orphaned project", async () => {
	const { storage, local } = await fixture();
	const setItem = local.setItem.bind(local);
	local.setItem = (key, value) => {
		if (key === "manga-current-project") throw new Error("Current project cannot be written");
		setItem(key, value);
	};
	assert.throws(() => storage.createProject({ name: "Failed creation" }), /cannot be written/);
	assert.deepEqual(storage.getProjectList(), []);
	assert.equal(Object.keys(local).some((key) => key.startsWith("manga-project-project-")), false);
});

test("metadata image-size updates are respected on reload", async () => {
	const { storage } = await fixture();
	const { id } = storage.createProject({ name: "Size" });
	storage.updateProjectMetadata(id, { imageSize: customSize });
	await save(storage, id);
	assert.deepEqual((await storage.loadProjectData(id)).imageSize, customSize);
});

test("an aborted deletion leaves the project intact", async () => {
	const { storage, idb } = await fixture();
	const { id } = storage.createProject({ name: "Keep me" });
	await save(storage, id, "Keep story", [{ panelNumber: 1, image: "keep-image" }]);
	idb.state.failNextWrite = true;
	await assert.rejects(storage.deleteProject(id), /aborted/);
	assert.equal((await storage.loadProjectData(id)).generatedPanels[0].image, "keep-image");
	assert.equal(storage.getCurrentProjectId(), id);
});


test("missing data for a populated project is not silently treated as blank", async () => {
	const { storage, local } = await fixture();
	const { id } = storage.createProject({ name: "Missing document" });
	await save(storage, id, "Original", [{ panelNumber: 1, image: "image" }]);
	local.removeItem(`manga-project-${id}`);
	assert.equal(await storage.loadProjectData(id), null);
});


test("project names and descriptions round-trip with optional save metadata", async () => {
	const { storage } = await fixture();
	const { id } = storage.createProject({ name: "Original", description: "Original description" });
	const metadata = { name: "Renamed project", description: "Updated description" };
	const saving = save(storage, id, "Story", [], { metadata });
	metadata.name = "Mutated after save";
	await saving;
	let restored = await storage.loadProjectData(id);
	assert.equal(restored.metadata.name, "Renamed project");
	assert.equal(restored.metadata.description, "Updated description");
	assert.equal(storage.getProjectList()[0].metadata.name, "Renamed project");
	await save(storage, id, "Edited story");
	restored = await storage.loadProjectData(id);
	assert.equal(restored.metadata.name, "Renamed project");
	assert.equal(restored.metadata.description, "Updated description");
	await save(storage, id, "Edited story", [], { metadata: { name: "No description" } });
	restored = await storage.loadProjectData(id);
	assert.equal(restored.metadata.name, "No description");
	assert.equal(restored.metadata.description, undefined);
});


test("an IndexedDB read failure fails the load without losing recoverable images", async () => {
	const { storage, idb, local } = await fixture();
	const { id } = storage.createProject({ name: "Recoverable" });
	await save(storage, id, "Original", [{ panelNumber: 1, image: "recoverable-image" }]);
	const savedDocument = local.getItem(`manga-project-${id}`);
	const savedImages = new Map(idb.state.records);
	idb.state.failNextRead = true;
	const originalError = console.error;
	const errors = [];
	console.error = (...args) => { errors.push(args); };
	try {
		assert.equal(await storage.loadProjectData(id), null);
	} finally {
		console.error = originalError;
	}
	assert.equal(errors.length, 1);
	assert.equal(local.getItem(`manga-project-${id}`), savedDocument);
	assert.deepEqual(idb.state.records, savedImages);
	assert.equal((await storage.loadProjectData(id)).generatedPanels[0].image, "recoverable-image");
});

test("large inline images stay out of localStorage including project thumbnails", async () => {
	const { storage, local } = await fixture();
	const { id } = storage.createProject({ name: "Large image" });
	const setItem = local.setItem.bind(local);
	local.setItem = (key, value) => {
		if (String(value).length > 1024 * 1024) throw new Error("localStorage quota exceeded");
		setItem(key, value);
	};
	const image = "data:image/png;base64," + "A".repeat(6 * 1024 * 1024);
	await save(storage, id, "Story", [{ panelNumber: 1, image }]);
	const restored = await storage.loadProjectData(id);
	assert.equal(restored.generatedPanels[0].image, image);
	assert.equal(restored.metadata.thumbnail, undefined);
	assert.equal(local.getItem("manga-projects-list").includes("data:image"), false);
	assert.equal(local.getItem(`manga-project-${id}`).includes("data:image"), false);
	await save(storage, id, "Story", [{ panelNumber: 1, image: "https://images.example/panel.png" }]);
	assert.equal((await storage.loadProjectData(id)).metadata.thumbnail, "https://images.example/panel.png");
});


test("separate app instances share a Web Lock across saves and revision cleanup", async () => {
	const { storage: firstTab, idb } = await fixture();
	const secondTab = await importStorageModule();
	const { id } = firstTab.createProject({ name: "Two tabs" });
	idb.state.holdNextWrite = true;
	const firstSave = save(firstTab, id, "First tab", [{ panelNumber: 1, image: "first-image" }]);
	while (!idb.state.release) await nextTurn();
	const secondSave = save(secondTab, id, "Second tab", [{ panelNumber: 1, image: "second-image" }]);
	await nextTurn();
	await nextTurn();
	assert.equal(idb.state.writes, 1, "the second tab must wait for the first tab's whole operation");
	idb.state.release();
	await Promise.all([firstSave, secondSave]);
	assert.equal((await firstTab.loadProjectData(id)).generatedPanels[0].image, "second-image");
	assert.equal((await secondTab.loadProjectData(id)).story, "Second tab");
	assert.equal(idb.state.records.size, 1);
});

test("without Web Locks, autosaves retain old image revisions instead of unsafe cleanup", async () => {
	const { storage: firstTab, idb } = await fixture({ withLocks: false });
	const secondTab = await importStorageModule();
	const { id } = firstTab.createProject({ name: "Lock-free fallback" });
	await save(firstTab, id, "First", [{ panelNumber: 1, image: "first-image" }]);
	const oldKeys = [...idb.state.records.keys()];
	await save(secondTab, id, "Second", [{ panelNumber: 1, image: "second-image" }]);
	assert.equal(idb.state.records.size, 2);
	assert.equal(idb.state.records.has(oldKeys[0]), true);
	assert.equal((await firstTab.loadProjectData(id)).generatedPanels[0].image, "second-image");
});


test("NeoWoW accounts have independent project lists, current project and text documents", async () => {
 const { storage, local } = await fixture();
 const alice=storage.createProjectStorage("neo-alice");
 const bob=storage.createProjectStorage("neo-bob");
 const a=alice.createProject({name:"Alice story",style:"manga"});
 const b=bob.createProject({name:"Bob story",style:"manga"});
 assert.deepEqual(alice.getProjectList().map(p=>p.metadata.id),[a.id]);
 assert.deepEqual(bob.getProjectList().map(p=>p.metadata.id),[b.id]);
 assert.equal(alice.getCurrentProjectId(),a.id);assert.equal(bob.getCurrentProjectId(),b.id);
 assert.equal(await bob.loadProjectData(a.id),null);
 assert.equal(storage.getProjectList().length,0);
 await alice.saveProjectData(a.id,"Alice's draft","manga",null,null,[],[]);
 assert.equal((await alice.loadProjectData(a.id)).story,"Alice's draft");
 assert.equal((await bob.loadProjectData(b.id)).story,"");
 await alice.deleteProject(a.id);
 assert.equal(bob.getProjectList().length,1);
 assert(Object.keys(local).some(key=>key.startsWith("manga-workspace-neo-bob-")));
});

// Application State
let state = {
    draggedItems: [],
    ghost: null,
    offset: { x: 0, y: 0 },
    lastMousePos: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 },
    isDragging: false,
    isPreviewOpen: false,
    isDirty: false,
    history: [],
    lastRightClick: 0
};

// Core Utilities
function markDirty() {
    state.isDirty = true;
}

function clearDirty() {
    state.isDirty = false;
}

function pushHistory() {
    const currentState = JSON.stringify(getState());
    if (state.history.length > 0 && state.history[state.history.length - 1] === currentState) return;
    state.history.push(currentState);
    if (state.history.length > 10) state.history.shift();
}

function undo() {
    if (state.history.length === 0) return;
    const previousState = JSON.parse(state.history.pop());
    loadState(previousState);
}

function getContainer(element) {
    let curr = element;
    while (curr) {
        if (curr.classList && curr.classList.contains('drop-zone')) return curr;
        if (curr.id === 'bench-items') return curr;
        if (curr.classList && curr.classList.contains('tier-row')) return curr.querySelector('.drop-zone');
        if (curr.id === 'bench') return document.getElementById('bench-items');
        curr = curr.parentElement;
    }
    return null;
}

// State Management
function getState() {
    const data = { tiers: {}, bench: [] };
    const wrappers = document.querySelectorAll('.tier-item-wrapper');
    
    for (const wrapper of wrappers) {
        const img = wrapper.querySelector('img');
        const note = wrapper.getAttribute('data-note') || "";
        const item = { src: img.src, id: wrapper.id, note: note };
        
        const container = wrapper.parentElement;
        if (!container) continue;
        if (container.id === 'bench-items') {
            data.bench.push(item);
        } else {
            const row = container.parentElement;
            if (row && row.id) {
                const tierId = row.id;
                if (!data.tiers[tierId]) data.tiers[tierId] = [];
                data.tiers[tierId].push(item);
            }
        }
    }
    return data;
}

function loadState(data) {
    if (!data) return;
    document.querySelectorAll('.tier-item-wrapper').forEach(el => el.remove());

    if (data.tiers) {
        Object.entries(data.tiers).forEach(([tierId, items]) => {
            const row = document.getElementById(tierId);
            if (row) {
                const dropZone = row.querySelector('.drop-zone');
                items.forEach(item => createTierImage(item.src, item.id, dropZone, true, item.note));
            }
        });
    }
    if (data.bench) {
        data.bench.forEach(item => createTierImage(item.src, item.id, document.getElementById('bench-items'), true, item.note));
    }
    updateBenchState(true);
    clearDirty();
}

// ... (handleSave and handleOpen stay the same, but let's update them to push history)

async function handleSave(saveAs = false) {
    const data = getState();
    const success = await window.pywebview.api.save_tier_list(data, saveAs);
    if (success) clearDirty();
}

async function handleOpen() {
    if (state.isDirty) {
        const confirmDiscard = confirm("You have unsaved changes. Are you sure you want to open a different tier list?");
        if (!confirmDiscard) return;
    }
    const data = await window.pywebview.api.load_tier_list();
    if (data) {
        pushHistory();
        loadState(data);
    }
}

// Image Preview
function openPreview(imgElement) {
    if (state.isDragging || state.isPreviewOpen) return;
    state.isPreviewOpen = true;

    const wrapper = imgElement.parentElement;
    const currentNote = wrapper.getAttribute('data-note') || "";

    const rect = imgElement.getBoundingClientRect();
    const overlay = document.createElement('div');
    overlay.id = 'preview-overlay';
    
    const previewImg = document.createElement('img');
    previewImg.src = imgElement.src;
    previewImg.className = 'preview-content';
    
    const closeBtn = document.createElement('div');
    closeBtn.className = 'preview-close-btn';
    closeBtn.innerText = '×';

    // Note Container in Preview
    const noteContainer = document.createElement('div');
    noteContainer.className = 'preview-note-container';
    
    const noteBox = document.createElement('div');
    noteBox.className = 'preview-note-box';
    
    const noteInput = document.createElement('input');
    noteInput.className = 'note-input';
    noteInput.value = currentNote;
    noteInput.placeholder = 'Add a note...';
    
    noteInput.onclick = (e) => e.stopPropagation();
    noteInput.oninput = (e) => {
        wrapper.setAttribute('data-note', e.target.value);
        markDirty();
    };
    
    noteBox.appendChild(noteInput);
    noteContainer.appendChild(noteBox);
    
    Object.assign(previewImg.style, {
        top: rect.top + 'px',
        left: rect.left + 'px',
        width: rect.width + 'px',
        height: rect.height + 'px',
        transform: 'none'
    });

    overlay.append(previewImg, closeBtn, noteContainer);
    document.body.appendChild(overlay);

    previewImg.offsetHeight;

    requestAnimationFrame(() => {
        overlay.classList.add('active');
        noteContainer.classList.add('active');
        previewImg.style.top = '50%';
        previewImg.style.left = '50%';
        
        const naturalRatio = imgElement.naturalWidth / imgElement.naturalHeight;
        const maxWidth = window.innerWidth * 0.9;
        const maxHeight = window.innerHeight * 0.8; // Leave room for note
        let targetWidth, targetHeight;
        if (naturalRatio > maxWidth / maxHeight) {
            targetWidth = maxWidth; targetHeight = maxWidth / naturalRatio;
        } else {
            targetHeight = maxHeight; targetWidth = maxHeight * naturalRatio;
        }
        
        previewImg.style.width = targetWidth + 'px';
        previewImg.style.height = targetHeight + 'px';
        previewImg.style.transform = 'translate(-50%, -50%)';
    });

    const close = () => {
        overlay.classList.remove('active');
        noteContainer.classList.remove('active');
        const currentRect = imgElement.getBoundingClientRect();
        previewImg.style.top = currentRect.top + 'px';
        previewImg.style.left = currentRect.left + 'px';
        previewImg.style.width = currentRect.width + 'px';
        previewImg.style.height = currentRect.height + 'px';
        previewImg.style.transform = 'none';
        setTimeout(() => { overlay.remove(); state.isPreviewOpen = false; }, 400);
    };

    overlay.onclick = close;
    closeBtn.onclick = (e) => { e.stopPropagation(); close(); };
}

// Image Management
function createTierImage(src, id, targetNode, immediate = false, note = "") {
    if (!src) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'tier-item-wrapper';
    wrapper.setAttribute('data-note', note);
    
    let finalId = id || (Date.now() + '_' + Math.random());
    if (!finalId.toString().startsWith('wrap_')) finalId = 'wrap_' + finalId;
    wrapper.id = finalId;

    const img = document.createElement('img');
    img.src = src;
    img.className = 'tier-item';

    const del = document.createElement('div');
    del.className = 'delete-btn';
    del.innerText = '×';

    wrapper.append(img, del);

    wrapper.onmousedown = (e) => {
        if (e.target.classList.contains('delete-btn')) return;
        state.wasPickedUp = false; 
        
        if (e.button === 0) { // Left Click
            let startX = e.clientX, startY = e.clientY, moved = false;

            const handleMove = (mv) => {
                if (!state.isDragging && (Math.abs(mv.clientX - startX) > 5 || Math.abs(mv.clientY - startY) > 5)) {
                    const rect = wrapper.getBoundingClientRect();
                    state.offset = { x: startX - rect.left, y: startY - rect.top };
                    state.lastMousePos = { x: startX, y: startY };
                    startDragging(mv, wrapper);
                    moved = true;
                }
                if (state.isDragging) onMouseMove(mv);
            };

            const handleUp = (up) => {
                if (up.button !== 0) return; // Only drop on Left Mouse release
                
                if (!moved) openPreview(img);
                else if (state.isDragging) onMouseUp(up);
                
                document.removeEventListener('mousemove', handleMove);
                document.removeEventListener('mouseup', handleUp);
            };

            document.addEventListener('mousemove', handleMove);
            document.addEventListener('mouseup', handleUp);

        } else if (e.button === 2 && state.isDragging) { // Right Click during Drag
            e.preventDefault();
            if (!state.draggedItems.includes(wrapper)) {
                state.draggedItems.push(wrapper);
                wrapper.style.opacity = '0';
                updateGhostContent();
                state.wasPickedUp = true; 
            }
        }
    };

    del.onmousedown = (e) => {
        e.stopPropagation();
        pushHistory();
        markDirty();
        const bench = document.getElementById('bench-items');
        wrapper.parentElement === bench ? wrapper.remove() : bench.appendChild(wrapper);
        updateBenchState();
    };
    
    const container = getContainer(targetNode) || document.getElementById('bench-items');
    if (container) container.appendChild(wrapper);
    updateBenchState(immediate);
    return wrapper;
}

// Button Animations
function updateBenchState(immediate = false) {
    const benchItems = document.getElementById('bench-items');
    const btn = document.getElementById('addImagesBtn');
    if (!benchItems || !btn) return;
    
    const hasItems = benchItems.children.length > 0;
    const currentlyInCorner = btn.classList.contains('in-corner');

    if (hasItems !== currentlyInCorner) {
        if (immediate) {
            hasItems ? btn.classList.add('in-corner') : btn.classList.remove('in-corner');
            return;
        }

        const isNowInCorner = hasItems;
        const startTrans = currentlyInCorner ? 'translate(0, 0)' : 'translate(-50%, -50%)';
        const endTrans = isNowInCorner ? 'translate(0, 0)' : 'translate(-50%, -50%)';

        btn.animate([
            { transform: `${startTrans} scale(1)`, opacity: 1 },
            { transform: `${startTrans} scale(0)`, opacity: 0 }
        ], { duration: 250, easing: 'ease-in', fill: 'forwards' }).onfinish = () => {
            isNowInCorner ? btn.classList.add('in-corner') : btn.classList.remove('in-corner');
            btn.animate([
                { transform: `${endTrans} scale(0)`, opacity: 0 },
                { transform: `${endTrans} scale(1.3)`, opacity: 1 },
                { transform: `${endTrans} scale(1)`, opacity: 1 }
            ], { duration: 400, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)', fill: 'forwards' });
        };
    }
}

// Drag Physics & Ghost
function updateGhostContent() {
    if (!state.ghost) return;
    state.ghost.innerHTML = '';
    
    const count = state.draggedItems.length;
    const maxSpread = 40;
    const angleStep = count > 1 ? (20 / count) : 0; // Dynamic angle inversely proportional to count
    const totalAngle = (count - 1) * angleStep;

    state.draggedItems.forEach((item, index) => {
        const itemClone = document.createElement('div');
        itemClone.className = 'drag-ghost-item';
        const img = item.querySelector('img').cloneNode();
        itemClone.appendChild(img);
        
        const rect = item.getBoundingClientRect();
        Object.assign(itemClone.style, {
            width: rect.width + 'px',
            height: rect.height + 'px'
        });

        const rotation = (index * angleStep) - (totalAngle / 2);
        itemClone.style.transform = `rotate(${rotation}deg)`;
        itemClone.style.zIndex = index;
        
        state.ghost.appendChild(itemClone);
    });

    if (count > 1) {
        const counter = document.createElement('div');
        counter.className = 'drag-counter';
        counter.innerText = count;
        state.ghost.appendChild(counter);
    }
}

function startDragging(e, wrapper) {
    state.isDragging = true;
    state.draggedItems = [wrapper];
    
    const rect = wrapper.getBoundingClientRect();
    state.ghost = document.createElement('div');
    state.ghost.className = 'drag-ghost-container';
    
    Object.assign(state.ghost.style, {
        width: rect.width + 'px',
        height: rect.height + 'px',
        left: rect.left + 'px',
        top: rect.top + 'px',
        transformOrigin: `${(state.offset.x / rect.width) * 100}% ${(state.offset.y / rect.height) * 100}%`
    });
    
    updateGhostContent();
    document.body.appendChild(state.ghost);
    wrapper.style.opacity = '0';
}

function onMouseMove(e) {
    if (!state.ghost) return;
    state.velocity.x = e.clientX - state.lastMousePos.x;
    state.velocity.y = e.clientY - state.lastMousePos.y;
    state.lastMousePos = { x: e.clientX, y: e.clientY };
    
    state.ghost.style.left = (e.clientX - state.offset.x) + 'px';
    state.ghost.style.top = (e.clientY - state.offset.y) + 'px';
    
    const { offsetWidth: w, offsetHeight: h } = state.ghost;
    const aspectRatio = w / h;
    const leverX = (state.offset.x - (w / 2)) / (w / 2);
    const leverY = (state.offset.y - (h / 2)) / (h / 2);
    
    const rotation = Math.max(Math.min((state.velocity.x * -leverY * 0.25) + (state.velocity.y * leverX * 0.7), 25), -25);
    state.ghost.style.transform = `rotate(${rotation}deg)`;
}

function onMouseUp(e) {
    if (!state.isDragging) return;
    
    state.ghost.style.display = 'none';
    const dropTarget = document.elementFromPoint(e.clientX, e.clientY);
    state.ghost.style.display = 'block';
    
    const container = getContainer(dropTarget);
    if (container) {
        pushHistory();
        
        // Find insertion index
        const children = [...container.querySelectorAll('.tier-item-wrapper')].filter(child => !state.draggedItems.includes(child));
        let insertBeforeNode = null;
        
        for (const child of children) {
            const rect = child.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            if (e.clientX < centerX) {
                insertBeforeNode = child;
                break;
            }
        }

        state.draggedItems.forEach(item => {
            if (insertBeforeNode) {
                container.insertBefore(item, insertBeforeNode);
            } else {
                container.appendChild(item);
            }
            item.style.opacity = '1';
        });
        markDirty();
    } else {
        state.draggedItems.forEach(item => item.style.opacity = '1');
    }
    
    if (state.ghost) state.ghost.remove();
    state.draggedItems = [];
    state.ghost = null;
    state.isDragging = false;
    updateBenchState();
}

// Global Event Listeners
window.oncontextmenu = (e) => {
    if (state.isDragging) {
        e.preventDefault();
        
        if (state.wasPickedUp) {
            state.wasPickedUp = false;
            state.lastRightClick = Date.now(); // Reset timer to prevent follow-up drop
            return;
        }

        const now = Date.now();
        if (now - state.lastRightClick < 300) { // Double Right Click
            const itemToDrop = state.draggedItems.pop();
            if (itemToDrop) {
                state.ghost.style.display = 'none';
                const dropTarget = document.elementFromPoint(state.lastMousePos.x, state.lastMousePos.y);
                state.ghost.style.display = 'block';
                const container = getContainer(dropTarget);
                if (container) {
                    pushHistory();
                    container.appendChild(itemToDrop);
                    itemToDrop.style.opacity = '1';
                    markDirty();
                } else {
                    itemToDrop.style.opacity = '1';
                }
                if (state.draggedItems.length === 0) {
                    onMouseUp({ clientX: state.lastMousePos.x, clientY: state.lastMousePos.y });
                } else {
                    updateGhostContent();
                }
            }
        }
        state.lastRightClick = now;
    }
};

window.ondragover = e => e.preventDefault();
window.ondrop = e => {
    e.preventDefault();
    if (e.dataTransfer.files.length > 0) {
        pushHistory();
        markDirty();
        [...e.dataTransfer.files].forEach(f => {
            if (f.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (ev) => createTierImage(ev.target.result);
                reader.readAsDataURL(f);
            }
        });
    }
};

window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
    } else if (e.ctrlKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSave(e.shiftKey);
    }
});

window.addEventListener('pywebviewready', () => {
    const api = window.pywebview.api;
    document.getElementById('addImagesBtn').onclick = () => {
        api.select_images().then(base64List => { 
            if (base64List && base64List.length > 0) {
                pushHistory();
                markDirty();
                base64List.forEach(b64 => createTierImage(b64)); 
            }
        });
    };
    api.get_startup_file().then(data => data ? loadState(data) : api.get_images().then(imgs => imgs.forEach((src, i) => createTierImage(src, 'init_' + i))));
    document.getElementById('saveBtn').onclick = handleSave;
    document.getElementById('loadBtn').onclick = handleOpen;
});

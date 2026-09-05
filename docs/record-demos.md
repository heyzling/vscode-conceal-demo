
## Recording the demos

The recordings in `examples/` are not animations: `src/recorder.ts` drives a real editor from
inside it, stopping at every frame, and `scripts/record.sh` photographs the window. Each scene
names the one file it is about, and its GIF is written beside that file under the scene's own name
— so [examples/README.md](examples/README.md) can link the file and show the picture without a path
being burnt into the frames.

```bash
CONCEAL_DEMO_FORK=/path/to/vscode-fork \
CONCEAL_DEMO_WINSHOT=/path/to/screenshot-helper.ps1 \
  ./scripts/record.sh              # every scene in examples/scenes.json
  ./scripts/record.sh 3            # every scene of section 3 — examples/3-*
  ./scripts/record.sh 31 33        # only those two scenes
```

It needs the conceal-capable fork (as `scripts/dev.sh` does), `ffmpeg`, and a screenshot helper
taking `-Hwnd`/`-Out` — this is a WSLg machine, where the editor window is a Win32 window like any
other and there is no Linux screenshot tool. Nothing is on a timer: the recorder writes a
rendezvous file when a state is ready and blocks until the picture has been taken, so no frame can
catch a half-applied decoration.

**A run owns the desktop's focus, so leave the machine alone while it records.** An editor command
is delivered to the *focused* editor, and a window that does not hold the foreground has none — the
keystroke is accepted, does nothing, and would be photographed under a caption saying it landed.
The script raises its window before every frame, and the recorder checks that each keystroke moved
the caret or changed the document, stopping with the name of the lost one rather than recording a
picture that lies.

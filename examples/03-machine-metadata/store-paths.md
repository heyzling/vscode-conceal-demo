# Long opaque machine ids

    /nix/store/9r6zsx7mvhw8gh5lqzlj6a5f5m9wr2q1-hello-2.12.1/bin/hello
    /nix/store/1a2b3c4d5e6f7g8h9i0jklmnopqrstuv-ripgrep-14.1.0/bin/rg

Emacs has `pretty-sha-path` for exactly this. The 32 characters are replaced by `…`, and hovering
shows what they were.

The design consequence is the interesting part: an identity scheme is often kept short *only* so
its marker stays bearable in text. With real concealment the marker costs one caret stop whatever
its length, so the length stops being an argument.

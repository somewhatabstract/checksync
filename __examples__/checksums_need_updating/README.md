In this example, we want the symlinks to get parsed first, so the folders are named such that the symlinks come first.

This verifies that our parsing will always parse and cache the real files even if the symlink is encountered first, ensuring paths are all canonical to the real path not the symlink path.

This is especially important for remote tags where the file path is part of the checksum hash - we need that to always be the real file, not the symlink.
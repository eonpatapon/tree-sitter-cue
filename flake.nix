{
  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs?ref=nixpkgs-unstable";
    utils.url = "github:numtide/flake-utils";
  };

  outputs = { utils, nixpkgs, ... }:
    let
      pkgs = nixpkgs.legacyPackages.x86_64-linux;
      mkGrammar = pkgs.callPackage
        (pkgs.path + "/pkgs/development/tools/parsing/tree-sitter/grammar.nix")
        { };
    in utils.lib.eachDefaultSystem (system: {

      packages.default = mkGrammar {
        language = "tree-sitter-cue";
        version = "0.0.1";
        src = ./.;
      };

      devShell = pkgs.mkShell {
        buildInputs = [
          pkgs.nodejs
          pkgs.bc
          pkgs.tree-sitter
          pkgs.python3
        ];
      };
    });
}

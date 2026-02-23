{
  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs?ref=nixpkgs-unstable";
    utils.url = "github:numtide/flake-utils";
  };

  outputs = { utils, nixpkgs, ... }:
    utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
        mkGrammar = pkgs.callPackage
          (pkgs.path + "/pkgs/development/tools/parsing/tree-sitter/grammar.nix")
          { };
      in {
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

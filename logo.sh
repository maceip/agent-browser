#!/bin/bash

# ANSI color codes for gradient: pink -> zinc
PINK='\033[38;2;236;72;153m'      # hot pink
ROSE='\033[38;2;219;39;119m'      # rose pink
FADE='\033[38;2;190;24;93m'       # pink-grey blend
ZINC='\033[38;2;161;161;170m'     # light zinc
DARK='\033[38;2;113;113;122m'     # dark zinc

NC='\033[0m' # No Color

echo ""
echo -e "${PINK}    ▄▀█ █▀▀ █▀▀ █▄░█ ▀█▀${NC}"
echo -e "${ROSE}    █▀█ █▄█ ██▄ █░▀█ ░█░${NC}"
echo ""
echo -e "${FADE}    █▄▄ █▀█ █▀█ █░█░█ █▀ █▀▀ █▀█${NC}"
echo -e "${ZINC}    █▄█ █▀▄ █▄█ ▀▄▀▄▀ ▄█ ██▄ █▀▄${NC}"
echo ""
echo -e "${DARK}    mcp-native browser automation${NC}"
echo -e "${DARK}    stealth + performance as primitives${NC}"
echo ""

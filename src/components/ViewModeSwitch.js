import React from "react";
import { Pressable } from "react-native";
import { AlertTriangle, BrainCircuit } from "lucide-react-native";
import styled from "styled-components/native";

import { colors, radii, shadows } from "../theme";

const MODES = [
  {
    key: "reported",
    label: "Live Reported",
    Icon: AlertTriangle
  },
  {
    key: "predicted",
    label: "AI Predicted Hotspots",
    Icon: BrainCircuit
  }
];

export default function ViewModeSwitch({ value, onChange }) {
  return (
    <SwitchShell>
      {MODES.map(({ key, label, Icon }) => {
        const active = key === value;
        return (
          <ModeButton
            key={key}
            onPress={() => onChange(key)}
            $active={active}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Icon size={16} color={active ? colors.white : colors.textMuted} />
            <ModeLabel $active={active}>{label}</ModeLabel>
          </ModeButton>
        );
      })}
    </SwitchShell>
  );
}

const SwitchShell = styled.View`
  flex-direction: row;
  padding: 4px;
  gap: 4px;
  border-radius: ${radii.panel}px;
  background-color: ${colors.mutedSurface};
  border-width: 1px;
  border-color: ${colors.border};
  ${shadows.panel}
`;

const ModeButton = styled(Pressable)`
  flex: 1;
  min-height: 42px;
  border-radius: ${radii.control}px;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 7px;
  background-color: ${({ $active }) => ($active ? colors.accent : "transparent")};
`;

const ModeLabel = styled.Text`
  color: ${({ $active }) => ($active ? colors.white : colors.textStrong)};
  font-size: 13px;
  font-weight: 800;
`;

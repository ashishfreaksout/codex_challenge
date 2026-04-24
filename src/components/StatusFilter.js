import React from "react";
import { Pressable } from "react-native";
import styled from "styled-components/native";

import { colors, radii, shadows } from "../theme";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "reported", label: "Reported" },
  { key: "fixed", label: "Fixed" }
];

export default function StatusFilter({ value, onChange, counts }) {
  return (
    <FilterShell>
      {FILTERS.map((filter) => {
        const isActive = filter.key === value;
        return (
          <FilterButton
            key={filter.key}
            onPress={() => onChange(filter.key)}
            $active={isActive}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
          >
            <FilterLabel $active={isActive}>{filter.label}</FilterLabel>
            <FilterCount $active={isActive}>{counts[filter.key] ?? 0}</FilterCount>
          </FilterButton>
        );
      })}
    </FilterShell>
  );
}

const FilterShell = styled.View`
  flex-direction: row;
  padding: 4px;
  gap: 4px;
  border-radius: ${radii.panel}px;
  background-color: ${colors.mutedSurface};
  border-width: 1px;
  border-color: ${colors.border};
  ${shadows.panel}
`;

const FilterButton = styled(Pressable)`
  flex: 1;
  min-height: 40px;
  border-radius: ${radii.control}px;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 6px;
  background-color: ${({ $active }) => ($active ? colors.ink : "transparent")};
`;

const FilterLabel = styled.Text`
  color: ${({ $active }) => ($active ? colors.white : colors.textStrong)};
  font-size: 13px;
  font-weight: 800;
`;

const FilterCount = styled.Text`
  min-width: 20px;
  color: ${({ $active }) => ($active ? colors.white : colors.textMuted)};
  font-size: 12px;
  font-weight: 800;
  text-align: center;
`;

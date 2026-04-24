import React, { useMemo, useState } from "react";
import { FlatList, Pressable } from "react-native";
import { MapPin, Search, X } from "lucide-react-native";
import styled from "styled-components/native";

import { SAN_JOSE_NEIGHBORHOODS } from "../constants/neighborhoods";
import { colors, radii, shadows } from "../theme";

export default function SearchBar({ onSelectNeighborhood }) {
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    if (!normalized) {
      return SAN_JOSE_NEIGHBORHOODS.slice(0, 4);
    }

    return SAN_JOSE_NEIGHBORHOODS.filter((neighborhood) =>
      neighborhood.name.toLowerCase().includes(normalized)
    ).slice(0, 5);
  }, [query]);

  const showResults = isFocused && results.length > 0;

  const handleSelect = (neighborhood) => {
    setQuery(neighborhood.name);
    setIsFocused(false);
    onSelectNeighborhood(neighborhood);
  };

  return (
    <SearchShell>
      <SearchRow>
        <Search size={19} color={colors.textMuted} />
        <SearchInput
          value={query}
          onChangeText={setQuery}
          onFocus={() => setIsFocused(true)}
          placeholder="Search San Jose neighborhoods"
          placeholderTextColor={colors.textMuted}
          returnKeyType="search"
        />
        {query ? (
          <ClearButton onPress={() => setQuery("")} accessibilityLabel="Clear search">
            <X size={17} color={colors.textMuted} />
          </ClearButton>
        ) : null}
      </SearchRow>

      {showResults ? (
        <ResultsList
          keyboardShouldPersistTaps="handled"
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ResultItem onPress={() => handleSelect(item)}>
              <MapPin size={16} color={colors.accent} />
              <ResultText>{item.name}</ResultText>
            </ResultItem>
          )}
        />
      ) : null}
    </SearchShell>
  );
}

const SearchShell = styled.View`
  border-radius: ${radii.panel}px;
  background-color: ${colors.surface};
  border-width: 1px;
  border-color: ${colors.border};
  overflow: hidden;
  ${shadows.panel}
`;

const SearchRow = styled.View`
  min-height: 50px;
  padding: 0 12px;
  flex-direction: row;
  align-items: center;
  gap: 10px;
`;

const SearchInput = styled.TextInput`
  flex: 1;
  color: ${colors.textStrong};
  font-size: 15px;
`;

const ClearButton = styled(Pressable)`
  width: 30px;
  height: 30px;
  align-items: center;
  justify-content: center;
  border-radius: 15px;
  background-color: ${colors.control};
`;

const ResultsList = styled(FlatList)`
  border-top-width: 1px;
  border-top-color: ${colors.border};
  max-height: 220px;
`;

const ResultItem = styled(Pressable)`
  min-height: 44px;
  padding: 0 12px;
  flex-direction: row;
  align-items: center;
  gap: 9px;
`;

const ResultText = styled.Text`
  color: ${colors.textStrong};
  font-size: 14px;
  font-weight: 600;
`;

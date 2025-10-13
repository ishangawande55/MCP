// SPDX-License-Identifier: MIT
// File: circuits/ApplicationZKP.circom
// Author: Ishan Gawande
// Description:
//   Stable, minimal, and unified ZKP circuit for
//   municipal applications (Birth, Death, Trade License, NOC).
//   Circom 2.0+ compliant with static component declarations.

pragma circom 2.0.0;

include "poseidon.circom";

// =======================================================
//  Field Hash Template
// =======================================================
template FieldHash() {
    signal input in;      // Private numeric input
    signal output out;    // Poseidon hash output

    component h = Poseidon(1);
    h.inputs[0] <== in;
    out <== h.out;
}

// =======================================================
//  Selective Disclosure Leaf
// =======================================================
template DisclosureLeaf() {
    signal input fieldValue;  // Private field value
    signal input disclosed;   // 1 = disclosed, 0 = hidden
    signal output hash;       // Leaf hash output

    component f = FieldHash();
    f.in <== fieldValue;

    // If not disclosed, zero out the hash
    hash <== disclosed * f.out;
}

// =======================================================
//  Simplified Application Circuit
// =======================================================
template ApplicationZKP(nFields) {
    // ---------- Public Inputs ----------
    signal input merkleRoot;        // Merkle root stored on-chain
    signal input applicationType;   // Type identifier (e.g., 1=BIRTH, 2=DEATH)

    // ---------- Private Inputs ----------
    signal input fields[nFields];    // Private field values
    signal input disclosed[nFields]; // Disclosure flags (1 or 0)

    // ---------- Hash Each Field ----------
    signal fieldHashes[nFields];
    component leaf[nFields];  // ✅ Declare components statically
    for (var i = 0; i < nFields; i++) {
        leaf[i] = DisclosureLeaf();
        leaf[i].fieldValue <== fields[i];
        leaf[i].disclosed <== disclosed[i];
        fieldHashes[i] <== leaf[i].hash;
    }

    // ---------- Aggregate Into Root ----------
    component rootHasher = Poseidon(nFields);
    for (var i = 0; i < nFields; i++) {
        rootHasher.inputs[i] <== fieldHashes[i];
    }

    // ---------- Enforce Equality ----------
    rootHasher.out === merkleRoot;
}

// =======================================================
//  Entry Point
// =======================================================
component main = ApplicationZKP(4);
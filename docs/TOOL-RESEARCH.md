# Research: Open-Source LLM Security Benchmarks

This document outlines high-quality open-source projects and benchmarks that can be integrated or adapted for the LLM Security Workbench.

## 🛠️ Red-Teaming & Vulnerability Scanners
Automated tools for probing LLMs for security gaps:

1. **[NVIDIA garak](https://github.com/NVIDIA/garak)**
   - **Description:** An LLM vulnerability scanner that probes for hallucinations, data leakage, prompt injection, and jailbreaks.
   - **Integration Idea:** Convert garak probe JSONL files into the workbench's `sample_threats.json` format.

2. **[Microsoft PyRIT](https://github.com/Azure/PyRIT)**
   - **Description:** Python Risk Identification Tool for automating red-teaming of generative AI applications.
   - **Goal:** Use PyRIT to generate multi-turn "Crescendo" attack sequences.

3. **[PurpleLlama (Meta)](https://github.com/facebookresearch/purple-llama)**
   - **Description:** Tools like `CyberSecEval` and `Llama Guard` to assess and mitigate risks in LLM applications.
   - **Standard:** Use these for benchmarking safe code generation.

## 📊 Benchmark Datasets
Standardized adversarial data to expand the `sample_threats.json` library:

4. **[JailbreakBench](https://github.com/JailbreakBench/jailbreakbench)**
   - **Focus:** Curated jailbreaking prompts and a leaderboard for model/defense performance.
   - **Use Case:** Verify if Phase 0.5 (Little Canary) catches threats that bypass native model filters.

5. **[HarmBench](https://github.com/centerforaisafety/HarmBench)**
   - **Focus:** Unified benchmark for evaluating safety against 200+ harmful behaviors.
   - **Goal:** Expand the "Toxic Content" and "Dangerous Behavior" categories.

6. **[AgentDojo](https://github.com/ethz-spylab/agentdojo)**
   - **Focus:** Security for **LLM Agents** with tool-use (RCE, file system, browser).
   - **Integration:** Test the workbench's ability to monitor agentic tool calls.

## 🛡️ Protection Frameworks
Libraries for modular security pipelines:

7. **[LLM Guard](https://github.com/protectai/llm-guard)**
   - **Description:** A modular toolkit for PII detection, secret scanning, and prompt injection filters.
   - **Idea:** Compare AIRS Phase 1 performance against LLM Guard's local engines.

8. **[Promptfoo](https://github.com/promptfoo/promptfoo)**
   - **Description:** A CLI tool for automated output evaluation and red-teaming.
   - **CI/CD:** Use promptfoo test cases to run security validations in a production pipeline.

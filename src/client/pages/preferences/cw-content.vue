<template>
<section class="_card">
	<div class="_title"><fa :icon="faEyeSlash"/> {{ $t('autoShowCwContent') }}</div>
	<div class="_content">
		<mk-switch v-model="autoShowCwContentAll">{{ $t('_autoShowCwContent.showAll') }}</mk-switch>
		<mk-textarea v-model="items" v-if="!autoShowCwContentAll">
			<span>{{ $t('_autoShowCwContent.showWords') }}</span>
			<template #desc>{{ $t('_autoShowCwContent.showWordsDescription') }}</template>
		</mk-textarea>
	</div>
	<div class="_footer" v-if="!autoShowCwContentAll">
		<mk-button inline @click="save()" primary :disabled="!changed"><fa :icon="faSave"/> {{ $t('save') }}</mk-button>
	</div>
</section>
</template>

<script lang="ts">
import Vue from 'vue';
import { faSave } from '@fortawesome/free-solid-svg-icons';
import { faEyeSlash } from '@fortawesome/free-regular-svg-icons';
import MkSwitch from '../../components/ui/switch.vue';
import MkButton from '../../components/ui/button.vue';
import MkTextarea from '../../components/ui/textarea.vue';

export default Vue.extend({
	components: {
		MkButton,
		MkTextarea,
		MkSwitch,
	},
	
	data() {
		return {
			items: (this.$store.state.device.showCwWords as string[]).join('\n'),
			changed: false,
			faEyeSlash, faSave,
		}
	},

	watch: {
		items() {
			this.changed = true;
		},

		autoShowCwContentAll() {
			location.reload()
		}
	},

	computed: {
		splited(): string[] {
			return this.items.trim().split('\n').filter(x => x.trim() !== '');
		},

		autoShowCwContentAll: {
			get() { return this.$store.state.device.autoShowCwContentAll; },
			set(value) { this.$store.commit('device/set', { key: 'autoShowCwContentAll', value }); }
		},
	},

	methods: {
		save() {
			this.$store.commit('device/set', { key: 'showCwWords', value: this.splited });
			this.changed = false;
			location.reload()
		},
	},
});
</script>

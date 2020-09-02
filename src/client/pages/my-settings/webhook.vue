<template>
<section class="_card">
	<div class="_title"><fa :icon="faLink"/> {{ $t('webhookNotification') }}</div>
		<div class="_content">
		<mk-info>{{ $t('_webhookNotification.description')}}</mk-info>
		<mk-switch v-model="enableWebhook" @change="save()">
			{{ $t('_webhookNotification.enable') }}
		</mk-switch>
		<mk-input v-model="url">
			<span>{{ $t('_webhookNotification.url') }}</span>
			<template #desc>{{ $t('_webhookNotification.urlDescription') }}</template>
		</mk-input>
	</div>
	<div class="_footer">
		<mk-button @click="save(true)" primary inline :disabled="!changed"><fa :icon="faSave"/> {{ $t('save') }}</mk-button>
	</div>
</section>
</template>

<script lang="ts">
import Vue from 'vue';
import { faLink } from '@fortawesome/free-solid-svg-icons';
import { faSave } from '@fortawesome/free-regular-svg-icons';
import MkButton from '../../components/ui/button.vue';
import MkInput from '../../components/ui/input.vue';
import MkSwitch from '../../components/ui/switch.vue';
import MkInfo from '../../components/ui/info.vue';

export default Vue.extend({
	components: {
		MkButton,
		MkInput,
		MkSwitch,
		MkInfo,
	},
	
	data() {
		return {
			enableWebhook: this.$store.state.i.enableWebhookNotification,
			url: this.$store.state.i.webhookUrl,
			changed: false,
			faSave, faLink,
		}
	},

	watch: {
		url() {
			this.changed = true;
		},
	},

	methods: {
		save(notify?: boolean) {
			this.$root.api('i/update', {
				enableWebhookNotification: this.enableWebhook,
				webhookUrl: this.url || null,
			}).then(() => {
				this.changed = false;
				if (notify) {
					this.$root.dialog({
						type: 'success',
						iconOnly: true,
						autoClose: true,
					});
				}
			}).catch((err) => {
				this.$root.dialog({
					type: 'error',
					text: err.id,
				});
			});
		},
	},
});
</script>
